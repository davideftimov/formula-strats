import os
import subprocess
import sys
import time
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.date import DateTrigger
import requests
import re
import requests
from icalendar import Calendar

CALENDAR_URL = os.getenv("CALENDAR_URL", "https://ics.ecal.com/ecal-sub/6831cb8cdb165a00083b099f/Formula%201.ics")
WEBSOCKET_PROGRAM_PATH = "ingestor/live.py"
PYTHON_EXECUTABLE = sys.executable
CHECK_CALENDAR_INTERVAL_HOURS = int(os.getenv("CHECK_CALENDAR_INTERVAL_HOURS", "6"))
JOB_ID_PREFIX = "websocket_ingest_"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

scheduler = BlockingScheduler(timezone=str(ZoneInfo("UTC")))

def get_future_events(ics_url: str) -> list[tuple]:
	"""
	Fetches an ICS calendar and returns a list of future events with start and end time.
	"""
	event_times = []
	try:
		response = requests.get(ics_url, timeout=10)
		response.raise_for_status()
		cal_content = response.text
	except requests.RequestException as e:
		logging.error(f"Error fetching ICS URL: {e}")
		return event_times

	try:
		cal = Calendar.from_ical(cal_content)
		now = datetime.now(ZoneInfo("UTC"))

		for component in cal.walk():
			if component.name == "VEVENT":
				dtstart = component.get('dtstart')
				dtend = component.get("dtend")
				summary = component.get('SUMMARY')
				
				if not dtstart or not dtend or not summary:
					continue

				event_start_time = dtstart.dt
				event_end_time = dtend.dt

				if event_start_time > now:
					match = re.search(r"-\s*(.+)$", summary)
					if match:
						event_type = match.group(1).strip()
						if event_type.__contains__("Race"):
							event_times.append((event_start_time, event_end_time))
	except Exception as e:
		logging.error(f"Error parsing ICS data: {e}")

	return sorted(event_times)

def run_websocket_program():
    """
    Runs the target websocket client program.
    """
    logging.info(f"Starting websocket program: {WEBSOCKET_PROGRAM_PATH}")
    try:
        process = subprocess.run(
            [PYTHON_EXECUTABLE, WEBSOCKET_PROGRAM_PATH],
            capture_output=True,
            text=True,
            check=False # Don't raise exception for non-zero exit, log it instead
        )
        if process.returncode == 0:
            logging.info(f"Websocket program finished successfully. Output:\n{process.stdout}")
        else:
            logging.error(
                f"Websocket program exited with error code {process.returncode}.\n"
                f"Stdout:\n{process.stdout}\n"
                f"Stderr:\n{process.stderr}"
            )
    except Exception as e:
        logging.error(f"Failed to run websocket program: {e}")


def update_schedules():
    """
    Fetches the calendar and updates the APScheduler jobs.
    """
    logging.info("Updating schedules from ICS calendar...")
    try:
        # 1. Remove old jobs
        jobs_to_remove = [job for job in scheduler.get_jobs() if job.id.startswith(JOB_ID_PREFIX)]
        for job in jobs_to_remove:
            logging.info(f"Removing old job: {job.id} scheduled for {job.trigger.run_date}")
            job.remove()

        # 2. Fetch new event times
        future_event_times = get_future_events(CALENDAR_URL)

        # 3. Add new jobs
        now = datetime.now(ZoneInfo("UTC"))
        for i, event in enumerate(future_event_times):
            if event[0] > now:
                job_id = f"{JOB_ID_PREFIX}{event[0].strftime('%Y%m%d%H%M%S')}_{i}"
                if event[0].tzinfo is None:
                    event_time_utc = event[0].replace(tzinfo=ZoneInfo("UTC"))
                else:
                    event_time_utc = event[0].astimezone(ZoneInfo("UTC"))

                run_time = event_time_utc - timedelta(minutes=10)

                logging.info(f"Scheduling job {job_id} for: {run_time} (event starts at {event_time_utc})")
                scheduler.add_job(
                    run_websocket_program,
                    trigger='date',
                    run_date=run_time,
                    id=job_id,
                    replace_existing=True # In case of race condition or ID collision
                )
            else:
                logging.info(f"Skipping past event: {event[0]}")

        logging.info(f"Schedule update complete. {len(scheduler.get_jobs())} jobs active.")
        for job in scheduler.get_jobs():
            logging.debug(f"Active job: {job.id} - Trigger: {job.trigger}")

    except Exception as e:
        logging.error(f"Error during schedule update: {e}", exc_info=True)

if __name__ == "__main__":
    logging.info("Scheduler starting. Performing initial schedule update.")
    update_schedules()

    scheduler.add_job(
        update_schedules,
        trigger='interval',
        hours=CHECK_CALENDAR_INTERVAL_HOURS,
        id='update_ics_schedules_job'
    )

    logging.info(
        f"Scheduler started. Will check for calendar updates every {CHECK_CALENDAR_INTERVAL_HOURS} hours."
    )
    logging.info("Press Ctrl+C to exit.")

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logging.info("Scheduler stopped.")
        scheduler.shutdown()
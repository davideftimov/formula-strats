# ics_parser.py
import re
import requests
from icalendar import Calendar
from datetime import datetime
from zoneinfo import ZoneInfo

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
		print(f"Error fetching ICS URL: {e}")
		return event_times

	try:
		cal = Calendar.from_ical(cal_content)
		now = datetime.now(ZoneInfo("UTC"))

		for component in cal.walk():
			# print(component)
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
		print(f"Error parsing ICS data: {e}")

	return sorted(event_times)

if __name__ == "__main__":
	CALENDAR_URL = "https://ics.ecal.com/ecal-sub/6831cb8cdb165a00083b099f/Formula%201.ics"
	future_events = get_future_events(CALENDAR_URL)
	if future_events:
		print("Upcoming scheduled runs:")
		for event in future_events:
			print(event)
	else:
		print("No upcoming events found in the next 7 days.")
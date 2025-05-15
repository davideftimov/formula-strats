from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import json

app = FastAPI()

# Allow your frontend origin here
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_URL = "https://livetiming.formula1.com/static"

@app.get("/api/f1-static/{full_path:path}")
def proxy_f1_static(full_path: str):
    # Build full URL
    url = f"{BASE_URL}/{full_path}"
    
    try:
        r = requests.get(url)
        r.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=str(e))

    try:
        return json.loads(r.content.decode("utf-8-sig"))
    except Exception:
        return {}

@app.get("/api/lap-data")
def get_lap_data():
    # Build full URL
    # url = f"{BASE_URL}/{full_path}"
    file_path = 'TimingData.jsonStream'

    try:
        return extract_all_lap_events(file_path)
    except Exception as e:
        print(f"Error in get_lap_data: {str(e)}")
        return []

def extract_all_lap_events(filepath):
    """
    Processes a stream of JSON-like lines from a file to extract all
    lap completion events for every driver.

    An event is recorded when a "NumberOfLaps" field and a corresponding
    non-empty "LastLapTime.Value" field are present for a driver in an update.
    The "NumberOfLaps" in such an event signifies the lap number that was just completed.

    Args:
        filepath (str): The path to the input file.

    Returns:
        list: A list of lap event objects. Each object has:
             - RacingNumber (str): The racing number of the driver (key from the "Lines" dict).
             - LapNumber (int): The lap number that was just completed.
             - LapTime (str): The time recorded for that completed lap.
    """
    lap_events = [] # This list will store all qualifying lap completion events

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line_number, line_content in enumerate(f, 1):
                line_content = line_content.strip()
                if not line_content:
                    continue

                # The JSON part starts after the first '{'
                try:
                    json_part_index = line_content.index('{')
                    json_str = line_content[json_part_index:]
                    parsed_json = json.loads(json_str)
                except ValueError:
                    # This happens if '{' is not found or line is malformed before JSON
                    # print(f"Warning: Line {line_number} does not contain JSON object or malformed: {line_content}")
                    continue
                except json.JSONDecodeError as e:
                    # print(f"Warning: Could not decode JSON on line {line_number}: {e} - Line: {line_content}")
                    continue

                lines_data = parsed_json.get("Lines")
                if not lines_data or not isinstance(lines_data, dict):
                    # If "Lines" is not present or not a dictionary, skip this update
                    continue

                for racing_number_str, driver_updates in lines_data.items():
                    # Ensure driver_updates is a dictionary before accessing its keys
                    if not isinstance(driver_updates, dict):
                        continue
                    
                    # Check if this update signifies a lap completion with a recorded time
                    if "NumberOfLaps" in driver_updates and "LastLapTime" in driver_updates:
                        num_laps_completed = driver_updates["NumberOfLaps"]
                        last_lap_time_obj = driver_updates.get("LastLapTime")

                        # Ensure LastLapTime is a dictionary and has a "Value"
                        if isinstance(last_lap_time_obj, dict):
                            lap_time_value = last_lap_time_obj.get("Value")
                            
                            # We only record the event if lap_time_value is non-empty
                            if lap_time_value: # Checks for None and empty string ""
                                event = {
                                    "RacingNumber": racing_number_str,
                                    "LapNumber": num_laps_completed, # This is the lap number just completed
                                    "LapTime": lap_time_value
                                }
                                lap_events.append(event)
    
    except FileNotFoundError:
        print(f"Error: File not found at {filepath}")
        return [] # Return empty list on error
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return [] # Return empty list on error

    # Return the Python list directly instead of converting to JSON string
    return lap_events
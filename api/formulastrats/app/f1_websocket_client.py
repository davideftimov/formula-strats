# f1_backend/app/f1_websocket_client.py
import asyncio
import json
import os
import websockets
from dotenv import load_dotenv
import ast  # Added import
import re  # Add this import

from .database import Session, engine  # Updated import

from .crud import create_f1_message, create_lap


load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))


F1_WEBSOCKET_URL_TO_USE = os.getenv("F1_SIMULATOR_WEBSOCKET_URL")
# F1_WEBSOCKET_URL_TO_USE = os.getenv("F1_WEBSOCKET_URL") # For real F1 feed

def fix_json(elem):
    # fix F1's not json compliant data
    elem = elem.replace("'", '"') \
        .replace('True', 'true') \
        .replace('False', 'false')
    
    # Escape unescaped double quotes within words, e.g., DELL"EMILIA -> DELL\"EMILIA
    # This targets a double quote surrounded by word characters (\w).
    elem = re.sub(r'(\w)"(\w)', r'\1\\"\2', elem)
    return elem

def extract_laps(json_line):
    """
    Processes a single JSON-like string line to extract all
    lap completion events for every driver.

    An event is recorded when a "NumberOfLaps" field and a corresponding
    non-empty "LastLapTime.Value" field are present for a driver in an update.
    The "NumberOfLaps" in such an event signifies the lap number that was just completed.

    Args:
        json_line_str (str): A single string containing a JSON-like structure.

    Returns:
        list: A list of lap event objects found in the line. Each object has:
             - RacingNumber (str): The racing number of the driver (key from the "Lines" dict).
             - LapNumber (int): The lap number that was just completed.
             - LapTime (str): The time recorded for that completed lap.
             Returns an empty list if no events are found or an error occurs.
    """
    lap_events = [] # This list will store all qualifying lap completion events

    try:

        # try:
        #     # Apply fix_json before parsing
        #     fixed_json_str = fix_json(json_line_str)
        #     parsed_json = json.loads(fixed_json_str)
        # except ValueError:
        #     # This happens if '{' is not found or line is malformed before JSON
        #     # print(f"Warning: Line does not contain JSON object or malformed: {line_content}")
        #     return []
        # except json.JSONDecodeError as e:
        #     # print(f"Warning: Could not decode JSON: {e} - Line: {line_content}")
        #     return []

        lines_data = json_line.get("Lines")
        if not lines_data or not isinstance(lines_data, dict):
            # If "Lines" is not present or not a dictionary, skip this update
            return []

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
    
    except Exception as e:
        # print(f"An unexpected error occurred while processing the line: {e}")
        return [] # Return empty list on error

    return lap_events

async def f1_data_listener():
    if not F1_WEBSOCKET_URL_TO_USE:
        print("F1_CLIENT_SQLMODEL: F1_WEBSOCKET_URL_TO_USE not set. Skipping connection.")
        return

    print(f"F1_CLIENT_SQLMODEL: Attempting to connect to F1 Data Source: {F1_WEBSOCKET_URL_TO_USE}")
    while True: # Keep trying to reconnect
        try:
            async with websockets.connect(F1_WEBSOCKET_URL_TO_USE) as websocket:
                print(f"F1_CLIENT_SQLMODEL: Successfully connected to: {F1_WEBSOCKET_URL_TO_USE}")
                async for message_str in websocket:
                    parsed_list = None  # Initialize for use in error messages
                    try:
                        message_str = fix_json(message_str)
                        # Replace json.loads with ast.literal_eval
                        # parsed_list = ast.literal_eval(message_str)

                        # if not isinstance(parsed_list, list) or len(parsed_list) != 3:
                        #     print(f"F1_CLIENT_SQLMODEL: Received message is not a list of 3 elements: {parsed_list}")
                        #     continue

                        message_type, payload, source_timestamp_str = json.loads(message_str)

                        if not isinstance(message_type, str) or not isinstance(payload, dict) or not isinstance(source_timestamp_str, str):
                            print(f"F1_CLIENT_SQLMODEL: Invalid data types in parsed message: Type={type(message_type)}, Payload={type(payload)}, TS={type(source_timestamp_str)}")
                            continue
                        
                        with Session(engine) as session:
                            db_message = create_f1_message(
                                session=session,
                                message_type=message_type,
                                payload=payload,
                                source_timestamp_str=source_timestamp_str
                            )
                            session.commit()  # Commit the transaction
                            print(f"F1_CLIENT_SQLMODEL: Stored message ID {db_message.id} (Type: {message_type})")
                        
                        laps = extract_laps(payload)
                        for lap in laps:
                            with Session(engine) as session:
                                # Assuming you have a function to create laps in the database
                                create_lap(
                                    session=session,
                                    lap_number=lap["LapNumber"],
                                    lap_time=lap["LapTime"],
                                    racing_number=lap["RacingNumber"]
                                )
                                session.commit()
                                print(f"F1_CLIENT_SQLMODEL: Stored lap data for RacingNumber {lap['RacingNumber']} (Lap: {lap['LapNumber']}, Time: {lap['LapTime']})")


                    except (json.JSONDecodeError, ValueError) as e_parse:
                        print(f"F1_CLIENT_SQLMODEL: Error parsing message with json.loads: {e_parse} - Original: {message_str}")
                    except ValueError as ve:  # Catches ValueErrors from subsequent logic
                        # Use parsed_list in the error message if available, otherwise message_str
                        original_content = parsed_list if parsed_list is not None else message_str
                        print(f"F1_CLIENT_SQLMODEL: Value error processing message data: {ve} - Original: {original_content}")
                    except Exception as e:
                        # Use parsed_list in the error message if available, otherwise message_str
                        original_content = parsed_list if parsed_list is not None else message_str
                        print(f"F1_CLIENT_SQLMODEL: Error processing F1 message: {e} - Original: {original_content}")

        except (websockets.exceptions.ConnectionClosed, ConnectionRefusedError, OSError) as e:
            print(f"F1_CLIENT_SQLMODEL: Connection error: {e}. Retrying in 5 seconds...")
            await asyncio.sleep(5)
        except Exception as e:
            print(f"F1_CLIENT_SQLMODEL: Unexpected error in listener: {e}. Retrying in 5 seconds...")
            await asyncio.sleep(5)
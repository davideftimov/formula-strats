import asyncio
import json
import os
import websockets
from dotenv import load_dotenv
import re
import redis.asyncio as redis

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))


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

def deep_merge_dicts(dict1, dict2):
    """
    Recursively merges dict2 into dict1.
    If a key exists in both and both values are dictionaries, it recursively merges them.
    Otherwise, the value from dict2 overwrites the value in dict1 or adds the new key-value.
    """
    merged = dict1.copy()  # Start with a copy of dict1 to avoid modifying the original during iteration

    for key, value_from_dict2 in dict2.items():
        if key in merged:
            # If key exists in merged and both values are dictionaries, recurse
            if isinstance(merged[key], dict) and isinstance(value_from_dict2, dict):
                merged[key] = deep_merge_dicts(merged[key], value_from_dict2)
            # If not both are dicts, or if key exists but types differ, value from dict2 overwrites
            else:
                merged[key] = value_from_dict2
        else:
            # If key is new, add it from dict2
            merged[key] = value_from_dict2
    return merged

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
                            "LapNumber": num_laps_completed, # This is the lap number just completed
                            "LapTime": lap_time_value,
                            "RacingNumber": racing_number_str,
                        }
                        lap_events.append(event)
    
    except Exception as e:
        # print(f"An unexpected error occurred while processing the line: {e}")
        return [] # Return empty list on error

    return lap_events

async def on_message(message, redis):
    try:
        message = fix_json(message)
        data = json.loads(message)
        if 'R' in data:
            initial_data_keys = ["DriverList", "SessionInfo", "TimingData"]
            for key in initial_data_keys:
                if key in data['R']:
                    print(f"F1_CLIENT_SQLMODEL: Initial data for {key}: {data['R'][key]}")
                    await redis.set(key, json.dumps({"type": key, "payload": data['R'][key]}))
        if 'M' in data:
            for msg_item in data.get('M', []):
                message_type, payload, source_timestamp_str = msg_item.get('A')
                if not isinstance(message_type, str) or not isinstance(payload, dict) or not isinstance(source_timestamp_str, str):
                    print(f"F1_CLIENT_SQLMODEL: Invalid data types in parsed message: Type={type(message_type)}, Payload={type(payload)}, TS={type(source_timestamp_str)}")
                    continue
                                
                # print(msg_item.get('A'))
                await redis.publish("channel:1", json.dumps({"type": message_type, "payload": payload}))
                # print(f"F1_CLIENT_SQLMODEL: Published message to Redis channel: {message_str}")

                existing_message_json_str = await redis.get(message_type)
                if existing_message_json_str:
                    stored_message_data_from_redis = json.loads(existing_message_json_str.decode('utf-8'))
                    retrieved_payload_component = stored_message_data_from_redis["payload"]
                    # Perform a deep merge
                    payload_to_be_set_in_redis = deep_merge_dicts(retrieved_payload_component, payload)
                else:
                    # If no existing data in Redis, the new payload is the one to be set
                    payload_to_be_set_in_redis = payload.copy() # Use a copy of the incoming payload

                await redis.set(message_type, json.dumps({"type": message_type, "payload": payload_to_be_set_in_redis}))
                # print(f"F1_CLIENT_SQLMODEL: Updated Redis key '{message_type}' with {len(payload)} fields.")

                laps = extract_laps(payload)
                if laps:
                    await redis.publish("channel:1", json.dumps({"type": "LapData", "payload": laps}))
                    # print(f"F1_CLIENT_SQLMODEL: Published LAP message to Redis channel: {laps}")
                
                for lap in laps:
                    await redis.rpush("LapData", json.dumps(lap))

    except json.JSONDecodeError as e_parse:
        print(f"Error parsing message with json.loads: {e_parse} - Original: {message}")
    except Exception as e:
        print(f"Error processing message: {e}")
	

async def f1_data_listener(redis):
    if not F1_WEBSOCKET_URL_TO_USE:
        print("F1_CLIENT_SQLMODEL: F1_WEBSOCKET_URL_TO_USE not set. Skipping connection.")
        return

    print(f"F1_CLIENT_SQLMODEL: Attempting to connect to F1 Data Source: {F1_WEBSOCKET_URL_TO_USE}")
    try:
        async with websockets.connect(F1_WEBSOCKET_URL_TO_USE) as websocket:
            print(f"F1_CLIENT_SQLMODEL: Successfully connected to: {F1_WEBSOCKET_URL_TO_USE}")
            async for message in websocket:
                await on_message(message, redis)

    except (websockets.exceptions.ConnectionClosed, ConnectionRefusedError, OSError) as e:
        print(f"Connection error: {e}. Retrying in 5 seconds...")
        await asyncio.sleep(5)
    except Exception as e:
        print(f"Unexpected error in listener: {e}. Retrying in 5 seconds...")
        await asyncio.sleep(5)

async def main():
    redis_client = redis.from_url('redis://localhost:16379')
    await redis_client.delete('DriverList')
    await redis_client.delete('SessionInfo')
    await redis_client.delete('TimingData')
    await redis_client.delete('LapData')
    await f1_data_listener(redis_client)

if __name__ == "__main__":
    asyncio.run(main())
import os
from dotenv import load_dotenv
import requests
import websockets
import json
import asyncio
import redis.asyncio as redis
import re  # Add this import at the top of the file

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

F1_SIMULATOR_WEBSOCKET_URL = os.getenv("F1_SIMULATOR_WEBSOCKET_URL")

def negotiate():
    hub = requests.utils.quote(json.dumps([{"name": "Streaming"}]))
    url = f"https://livetiming.formula1.com/signalr/negotiate?connectionData={hub}&clientProtocol=1.5"
    resp = requests.get(url)
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        return resp
    except requests.exceptions.RequestException as e:
        print(f"Error during negotiation: {e}")
        raise

async def connect_wss(token, cookie):
    hub = requests.utils.quote(json.dumps([{"name": "Streaming"}]))
    encoded_token = requests.utils.quote(token)
    url = f"wss://livetiming.formula1.com/signalr/connect?clientProtocol=1.5&transport=webSockets&connectionToken={encoded_token}&connectionData={hub}"
    
    additional_headers = {
        'Accept-Encoding': 'gzip,identity',
        'Cookie': cookie
    }
    
    websocket = await websockets.connect(
        url, 
        additional_headers=additional_headers,
        user_agent_header='BestHTTP'
    )
    return websocket

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
            initial_data_keys = ["DriverList", "SessionInfo", "LapCount", "TrackStatus", "TimingData", "WeatherData"]
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

message_queue = asyncio.Queue()

async def receiver(websocket):
    while True:
        data = await websocket.recv()
        await message_queue.put(data)

async def processor(redis):
    while True:
        msg = await message_queue.get()
        await on_message(msg, redis)
        message_queue.task_done()

async def main():
    redis_client = redis.from_url('redis://localhost:16379')
    await redis_client.delete('DriverList')
    await redis_client.delete('SessionInfo')
    await redis_client.delete('LapCount')
    await redis_client.delete('TrackStatus')
    await redis_client.delete('TimingData')
    await redis_client.delete('LapData')
    await redis_client.delete('WeatherData')
    simulation = False
    try:
        if simulation:
            websocket = await websockets.connect(F1_SIMULATOR_WEBSOCKET_URL) 
        else:
            negotiate_resp = negotiate()

            negotiate_data = negotiate_resp.json()
            
            # print(negotiate_data)
            # print(negotiate_resp.headers)

            connection_token = negotiate_data.get('ConnectionToken')
            if not connection_token:
                raise ValueError("ConnectionToken not found in negotiation response")
            
            cookie_header_value = negotiate_resp.headers.get('Set-Cookie')
            if not cookie_header_value:
                raise ValueError("Set-Cookie header not found in negotiation response")
            
            websocket = await connect_wss(connection_token, cookie_header_value)
            
            await websocket.send(json.dumps({
                "H": "Streaming",
                "M": "Subscribe",
                "A": [["TimingData", "SessionInfo", "LapCount", "TrackStatus", "DriverList", "WeatherData"]],
                "I": 1
            }))
        
        # Listen for messages
        # while True:
        #     data = await websocket.recv()
        #     # print(f"received {data}")
        #     # Process the received message
        #     await on_message(data, redis_client)
        asyncio.create_task(receiver(websocket))
        asyncio.create_task(processor(redis_client))

        # Keep main alive
        await asyncio.Event().wait()

    except websockets.exceptions.ConnectionClosed as e:
        print(f"WebSocket connection closed: {e}")
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
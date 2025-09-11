import os
from dotenv import load_dotenv
import requests
import websockets
import json
import asyncio
import redis.asyncio as redis
import re

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

F1_SIMULATOR_WEBSOCKET_URL = os.getenv("F1_SIMULATOR_WEBSOCKET_URL")
SIMULATION = os.getenv("SIMULATION", "false").lower() == "true"

def negotiate():
    hub = requests.utils.quote(json.dumps([{"name": "Streaming"}]))
    url = f"https://livetiming.formula1.com/signalr/negotiate?connectionData={hub}&clientProtocol=1.5"
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
    merged = dict1.copy()
    for key, value_from_dict2 in dict2.items():
        if key in merged:
            if isinstance(merged[key], dict) and isinstance(value_from_dict2, dict):
                merged[key] = deep_merge_dicts(merged[key], value_from_dict2)
            else:
                merged[key] = value_from_dict2
        else:
            merged[key] = value_from_dict2
    return merged

def extract_laps(payload):
    lap_events = []
    try:
        lines_data = payload.get("Lines")
        if not lines_data or not isinstance(lines_data, dict):
            return []

        for racing_number_str, driver_updates in lines_data.items():
            if not isinstance(driver_updates, dict):
                continue
            
            if "NumberOfLaps" in driver_updates and "LastLapTime" in driver_updates:
                num_laps_completed = driver_updates["NumberOfLaps"]
                last_lap_time_obj = driver_updates.get("LastLapTime")

                if isinstance(last_lap_time_obj, dict):
                    lap_time_value = last_lap_time_obj.get("Value")
                    
                    if lap_time_value:
                        event = {
                            "LapNumber": num_laps_completed,
                            "LapTime": lap_time_value,
                            "RacingNumber": racing_number_str,
                        }
                        lap_events.append(event)
    
    except Exception as e:
        print(f"An unexpected error occurred while processing the payload: {e}")
        return []

    return lap_events

async def on_message(message, redis_client):
    try:
        message = fix_json(message)
        data = json.loads(message)
        if 'R' in data:
            initial_data_keys = ["DriverList", "SessionInfo", "LapCount", "TrackStatus", "TimingData", "WeatherData"]
            for key in initial_data_keys:
                if key in data['R']:
                    print(f"F1_CLIENT_SQLMODEL: Initial data for {key}: {data['R'][key]}")
                    await redis_client.set(key, json.dumps({"type": key, "payload": data['R'][key]}))
        if 'M' in data:
            for msg_item in data.get('M', []):
                message_type, payload, source_timestamp_str = msg_item.get('A')
                if not isinstance(message_type, str) or not isinstance(payload, dict) or not isinstance(source_timestamp_str, str):
                    print(f"F1_CLIENT_SQLMODEL: Invalid data types in parsed message: Type={type(message_type)}, Payload={type(payload)}, TS={type(source_timestamp_str)}")
                    continue
                                
                await redis_client.publish("channel:1", json.dumps({"type": message_type, "payload": payload}))

                existing_message_json_str = await redis_client.get(message_type)
                if existing_message_json_str:
                    stored_message_data_from_redis = json.loads(existing_message_json_str)
                    retrieved_payload_component = stored_message_data_from_redis["payload"]
                    payload_to_be_set_in_redis = deep_merge_dicts(retrieved_payload_component, payload)
                else:
                    payload_to_be_set_in_redis = payload.copy()

                await redis_client.set(message_type, json.dumps({"type": message_type, "payload": payload_to_be_set_in_redis}))

                laps = extract_laps(payload)
                if laps:
                    await redis_client.publish("channel:1", json.dumps({"type": "LapData", "payload": laps}))
                
                for lap in laps:
                    await redis_client.rpush("LapData", json.dumps(lap))

    except json.JSONDecodeError as e_parse:
        print(f"Error parsing message with json.loads: {e_parse} - Original: {message}")
    except Exception as e:
        print(f"Error processing message: {e}")

message_queue = asyncio.Queue()

async def receiver(websocket):
    while True:
        data = await websocket.recv()
        await message_queue.put(data)

async def processor(redis_client):
    while True:
        msg = await message_queue.get()
        await on_message(msg, redis_client)
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
    try:
        if SIMULATION:
            websocket = await websockets.connect(F1_SIMULATOR_WEBSOCKET_URL) 
        else:
            negotiate_resp = negotiate()
            negotiate_data = negotiate_resp.json()
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
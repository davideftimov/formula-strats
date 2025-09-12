import os
import requests
import websockets
import json
import asyncio
import redis.asyncio as redis
import re
import logging
import signal
import time

# Setup basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Configuration ---
F1_SIMULATOR_WEBSOCKET_URL = os.getenv("F1_SIMULATOR_WEBSOCKET_URL")
SIMULATION = os.getenv("SIMULATION", "false").lower() == "true"
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:16379")
INACTIVITY_TIMEOUT = int(os.getenv("INACTIVITY_TIMEOUT", "60"))
MONITOR_INTERVAL = int(os.getenv("MONITOR_INTERVAL", "10"))
MAX_RECONNECT_DELAY = int(os.getenv("MAX_RECONNECT_DELAY", "60"))


def fix_json(elem):
    """Cleans up F1's non-compliant JSON data."""
    elem = elem.replace("'", '"').replace('True', 'true').replace('False', 'false')
    elem = re.sub(r'(\w)"(\w)', r'\1\\"\2', elem)
    return elem

def deep_merge_dicts(dict1, dict2):
    """Recursively merges two dictionaries."""
    merged = dict1.copy()
    for key, value_from_dict2 in dict2.items():
        if key in merged and isinstance(merged.get(key), dict) and isinstance(value_from_dict2, dict):
            merged[key] = deep_merge_dicts(merged[key], value_from_dict2)
        else:
            merged[key] = value_from_dict2
    return merged

def extract_laps(payload):
    """Extracts lap time events from the payload."""
    lap_events = []
    try:
        lines_data = payload.get("Lines")
        if not isinstance(lines_data, dict):
            return []

        for racing_number, driver_updates in lines_data.items():
            if isinstance(driver_updates, dict) and "NumberOfLaps" in driver_updates and "LastLapTime" in driver_updates:
                last_lap_time_obj = driver_updates.get("LastLapTime")
                if isinstance(last_lap_time_obj, dict) and (lap_time_value := last_lap_time_obj.get("Value")):
                    lap_events.append({
                        "LapNumber": driver_updates["NumberOfLaps"],
                        "LapTime": lap_time_value,
                        "RacingNumber": racing_number,
                    })
    except Exception as e:
        logging.error(f"Error extracting lap data: {e}")
    return lap_events


class LiveFeed:
    def __init__(self):
        self._redis_client = redis.from_url(REDIS_URL)
        self._websocket = None
        self._message_queue = asyncio.Queue()
        self._shutdown_event = asyncio.Event()
        self._tasks = []
        self._last_activity_time = None

    async def _negotiate(self):
        """Negotiates with the F1 SignalR server to get a connection token."""
        hub = requests.utils.quote(json.dumps([{"name": "Streaming"}]))
        url = f"https://livetiming.formula1.com/signalr/negotiate?connectionData={hub}&clientProtocol=1.5"
        try:
            # Using asyncio.to_thread to run the synchronous requests call
            loop = asyncio.get_running_loop()
            resp = await loop.run_in_executor(None, lambda: requests.get(url, timeout=10))
            resp.raise_for_status()
            return resp
        except requests.exceptions.RequestException as e:
            logging.error(f"Error during negotiation: {e}")
            raise

    async def _connect_wss(self, token, cookie):
        """Establishes a WebSocket connection."""
        hub = requests.utils.quote(json.dumps([{"name": "Streaming"}]))
        encoded_token = requests.utils.quote(token)
        url = f"wss://livetiming.formula1.com/signalr/connect?clientProtocol=1.5&transport=webSockets&connectionToken={encoded_token}&connectionData={hub}"
        
        headers = {'Accept-Encoding': 'gzip,identity', 'Cookie': cookie}
        return await websockets.connect(url, additional_headers=headers, user_agent_header='BestHTTP')

    async def _subscribe_to_topics(self):
        """Subscribes to the desired data topics on the WebSocket."""
        await self._websocket.send(json.dumps({
            "H": "Streaming",
            "M": "Subscribe",
            "A": [["Heartbeat", "TimingData", "SessionInfo", "LapCount", "TrackStatus", "DriverList", "WeatherData"]],
            "I": 1
        }))

    async def _connect(self):
        """Handles the connection logic, including simulation mode."""
        if SIMULATION:
            return await websockets.connect(F1_SIMULATOR_WEBSOCKET_URL)
        else:
            negotiate_resp = await self._negotiate()
            negotiate_data = negotiate_resp.json()
            connection_token = negotiate_data.get('ConnectionToken')
            cookie_header = negotiate_resp.headers.get('Set-Cookie')
            
            if not connection_token or not cookie_header:
                raise ValueError("Negotiation failed: Missing token or cookie.")
            
            return await self._connect_wss(connection_token, cookie_header)

    async def _connection_handler(self):
        """Manages the WebSocket connection and reconnection attempts."""
        delay = 1
        while not self._shutdown_event.is_set():
            try:
                self._websocket = await self._connect()
                if not SIMULATION:
                    await self._subscribe_to_topics()
                logging.info("WebSocket connection established.")
                delay = 1  # Reset delay on successful connection
                await self._receiver()
            except (websockets.exceptions.ConnectionClosed, ValueError, requests.exceptions.RequestException) as e:
                logging.warning(f"Connection error: {e}. Reconnecting in {delay}s...")
            except Exception as e:
                logging.error(f"An unexpected error occurred in connection handler: {e}")
            finally:
                if self._websocket:
                    await self._websocket.close()
                if not self._shutdown_event.is_set():
                    await asyncio.sleep(delay)
                    delay = min(delay * 2, MAX_RECONNECT_DELAY)

    async def _receiver(self):
        """Receives messages from the WebSocket and puts them on the queue."""
        async for message in self._websocket:
            if message != '{}':
                self._last_activity_time = time.monotonic()
            await self._message_queue.put(message)

    async def _processor(self):
        """Processes messages from the queue."""
        while not self._shutdown_event.is_set():
            try:
                message = await self._message_queue.get()
                await self._on_message(message)
                self._message_queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logging.error(f"Error in processor: {e}")

    async def _on_message(self, message):
        """Parses and handles a single message."""
        try:
            message = fix_json(message)
            data = json.loads(message)

            if 'R' in data:
                for key, payload in data['R'].items():
                    logging.info(f"Received initial data for {key}")
                    await self._redis_client.set(key, json.dumps({"type": key, "payload": payload}))
            
            if 'M' in data:
                for msg_item in data.get('M', []):
                    if len(msg_item.get('A', [])) == 3:
                        msg_type, payload, _ = msg_item['A']
                        await self._process_stream_message(msg_type, payload)

        except json.JSONDecodeError as e:
            logging.warning(f"JSON decode error: {e} - Original: {message}")
        except Exception as e:
            logging.error(f"Error processing message: {e}")

    async def _process_stream_message(self, msg_type, payload):
        """Handles a streaming message of a given type."""
        await self._redis_client.publish("channel:1", json.dumps({"type": msg_type, "payload": payload}))

        existing_json = await self._redis_client.get(msg_type)
        if existing_json:
            existing_data = json.loads(existing_json)
            new_payload = deep_merge_dicts(existing_data.get("payload", {}), payload)
        else:
            new_payload = payload

        await self._redis_client.set(msg_type, json.dumps({"type": msg_type, "payload": new_payload}))

        if laps := extract_laps(payload):
            await self._redis_client.publish("channel:1", json.dumps({"type": "LapData", "payload": laps}))
            for lap in laps:
                await self._redis_client.rpush("LapData", json.dumps(lap))

    async def _monitor(self):
        """Monitors for inactivity and triggers shutdown if needed."""
        self._last_activity_time = time.monotonic()
        while not self._shutdown_event.is_set():
            await asyncio.sleep(MONITOR_INTERVAL)
            if time.monotonic() - self._last_activity_time > INACTIVITY_TIMEOUT:
                logging.warning("No meaningful activity for over a minute, shutting down.")
                self.stop()
                break
    
    async def _clear_redis(self):
        """Clears relevant keys in Redis."""
        logging.info("Clearing Redis keys...")
        keys_to_delete = [
            "Heartbeat", "DriverList", "SessionInfo", "LapCount", 
            "TrackStatus", "TimingData", "LapData", "WeatherData"
        ]
        await self._redis_client.delete(*keys_to_delete)

    async def run(self):
        """Main entry point to start the service."""
        await self._clear_redis()
        
        self._tasks = [
            asyncio.create_task(self._connection_handler()),
            asyncio.create_task(self._processor()),
            asyncio.create_task(self._monitor())
        ]
        
        logging.info("Live feed service started.")
        await self._shutdown_event.wait()
        logging.info("Shutdown signal received.")

        for task in self._tasks:
            task.cancel()
        
        await asyncio.gather(*self._tasks, return_exceptions=True)

        if self._websocket:
            await self._websocket.close()
        await self._redis_client.aclose()
        logging.info("Live feed service stopped.")

    def stop(self):
        """Initiates a graceful shutdown."""
        self._shutdown_event.set()


async def main():
    feed = LiveFeed()
    
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, feed.stop)
        
    await feed.run()

if __name__ == "__main__":
    asyncio.run(main())

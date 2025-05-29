import requests
import json
from websocket import create_connection
from datetime import datetime

LOG_FILE = "messages5.log"

def negotiate():
    hub = json.dumps([{"name": "Streaming"}])
    url = f"https://livetiming.formula1.com/signalr/negotiate?connectionData={requests.utils.quote(hub)}&clientProtocol=1.5"
    headers = {
        "User-Agent": "BestHTTP",
        "Accept-Encoding": "gzip,identity"
    }
    resp = requests.get(url, headers=headers)
    resp.raise_for_status()
    return resp.json(), resp.headers.get("Set-Cookie", "")

def connect_wss(token, cookie):
    hub = json.dumps([{"name": "Streaming"}])
    encoded_hub = requests.utils.quote(hub)
    encoded_token = requests.utils.quote(token)
    url = f"wss://livetiming.formula1.com/signalr/connect?clientProtocol=1.5&transport=webSockets&connectionToken={encoded_token}&connectionData={encoded_hub}"

    headers = {
        "User-Agent": "BestHTTP",
        "Accept-Encoding": "gzip,identity",
        "Cookie": cookie
    }

    ws = create_connection(url, header=[f"{k}: {v}" for k, v in headers.items()])
    return ws

def save_message(message):
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        current_time = datetime.now().strftime("[%Y-%m-%d %H:%M:%S]")
        f.write(f"{current_time} {message}\n")

def main():
    try:
        data, cookie = negotiate()
        print("Negotiate Response:", data)
        print("Cookie:", cookie)

        conn_token = data["ConnectionToken"]
        ws = connect_wss(conn_token, cookie)

        subscribe_payload = {
            "H": "Streaming",
            "M": "Subscribe",
            "A": [["TimingData", "SessionInfo", "DriverList"]],
            "I": 1
        }

        ws.send(json.dumps(subscribe_payload))
        print("Subscribed!")

        while True:
            msg = ws.recv()
            print("Received:", msg)
            save_message(msg)

    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()


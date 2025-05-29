import asyncio
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from pathlib import Path

app = FastAPI(title="F1 Data Simulator")

DATA_FILE = Path(__file__).parent / "messages5.log"
MESSAGE_DELAY = 0.1 # Adjust as needed

@app.websocket("/ws/f1-data")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Simulator: Client connected")
    try:
        if not DATA_FILE.exists():
            print(f"Simulator: Data file not found at {DATA_FILE}")
            await websocket.send_text('{"error": "Data file not found on server"}')
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.close(code=1011)
            print("Simulator: Closed connection due to missing data file.")
            return

        with open(DATA_FILE, "r") as f:
            for line in f:
                message = line.strip()
                if message:
                    if websocket.client_state != WebSocketState.CONNECTED:
                        print("Simulator: Client disconnected before sending all data (checked before send).")
                        break
                    await websocket.send_text(message)
                    print(f"Simulator: Sent: {message}")
                    await asyncio.sleep(MESSAGE_DELAY)
            
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_text('{"status": "simulation_finished"}')
            print("Simulator: Finished sending all data. Server will now close the connection.")
            await websocket.close(code=1000)
            print("Simulator: Server initiated graceful close.")
        else:
            print("Simulator: Client disconnected before simulation could finish completely.")


    except WebSocketDisconnect:
        print("Simulator: Client disconnected or connection lost (WebSocketDisconnect caught).")
    except Exception as e:
        print(f"Simulator: An unexpected error occurred in the main try block: {e} (Type: {type(e)})")
        if websocket.client_state == WebSocketState.CONNECTED:
            try:
                print("Simulator: Attempting to close WebSocket due to server-side exception.")
                await websocket.close(code=1011)
            except RuntimeError as rt_err:
                print(f"Simulator: RuntimeError while trying to close after exception: {rt_err}. Connection likely already dead.")
            except Exception as close_err:
                print(f"Simulator: Exception while trying to close after an exception: {close_err}.")
    finally:
        print(f"Simulator: WebSocket handler scope ending. Current client state: {websocket.client_state}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
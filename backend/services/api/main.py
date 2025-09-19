import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from redis import asyncio as aioredis, exceptions

from fastapi.responses import StreamingResponse
from fastapi import Request, Depends
import json

STOPWORD = "STOP"
REDIS_CHANNEL_NAME = "channel:1"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ===== Startup Logic =====
    print("Application startup: Initializing resources...")

    redis_url = os.getenv("REDIS_URL", "redis://redis:16379")
    redis_client = aioredis.from_url(redis_url)
    app.state.redis = redis_client

    print("Application startup complete.")
    yield
    # ===== Shutdown Logic =====
    print("Application shutdown: Cleaning up resources...")

    await app.state.redis.aclose()
    
    print("Application shutdown complete.")

app = FastAPI(title="F1 Live Data Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/f1-stream/", response_model=None)
async def stream_f1_data(
    request: Request,
):
    async def event_generator():
        redis_client = None
        pubsub = None
        try:
            redis_client = request.app.state.redis

            initial_data_keys = ["DriverList", "SessionInfo", "LapCount", "TrackStatus", "RaceControlMessages", "TimingData", "WeatherData", "Heartbeat"]
            for key in initial_data_keys:
                try:
                    message_data_bytes = await redis_client.get(key)
                    if message_data_bytes:
                        message_data_str = message_data_bytes.decode('utf-8')
                        yield f"data: {message_data_str}\n\n"
                    else:
                        print(f"(SSE Stream) No initial data found for {key}")
                except Exception as e:
                    print(f"Error retrieving initial data for {key} from Redis: {e}")
                    yield f"event: error\ndata: Error fetching initial {key}: {str(e)}\n\n"
            
            laps = await redis_client.lrange("LapData", 0, -1)
            if laps:
                laps = [el.decode('utf-8') for el in laps]
                laps = [json.loads(lap) for lap in laps]
                chunk_size = 50  # Send 50 laps at a time
                for i in range(0, len(laps), chunk_size):
                    laps_chunk = laps[i:i + chunk_size]
                    laps_json = json.dumps({"type": "LapData", "payload": laps_chunk})
                    yield f"data: {laps_json}\n\n"

            pubsub = redis_client.pubsub()
            await pubsub.subscribe(REDIS_CHANNEL_NAME)
            print(f"SSE stream subscribed to Redis channel: {REDIS_CHANNEL_NAME}")

            while True:
                if await request.is_disconnected():
                    print("Client disconnected from SSE stream (Redis).")
                    break

                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                
                if message is not None and message.get("type") == "message":
                    message_data_bytes = message["data"]
                    message_data_str = message_data_bytes.decode('utf-8')

                    if message_data_str == STOPWORD:
                        print("(SSE Stream) STOPWORD received, closing stream.")
                        # yield f"event: stop\ndata: Server stopping stream\n\n"
                        break
                    
                    yield f"data: {message_data_str}\n\n"

        except asyncio.CancelledError:
            print("SSE stream cancelled on server side (Redis).")
        except exceptions.ConnectionError as e:
            print(f"SSE stream: Redis connection error: {e}")
            yield f"event: error\ndata: Redis connection error: {str(e)}\n\n"
        except Exception as e:
            print(f"Error in SSE event_generator (Redis): {e}")
            yield f"event: error\ndata: Internal server error: {str(e)}\n\n"
        finally:
            # print("SSE Stream closing (Redis)...")
            # if pubsub:
            #     try:
            #         await pubsub.unsubscribe(REDIS_CHANNEL_NAME)
            #         print(f"Unsubscribed from Redis channel: {REDIS_CHANNEL_NAME}")
            #     except Exception as e:
            #         print(f"Error unsubscribing from Redis channel: {e}")
            #     finally:
            #         try:
            #             await pubsub.close() # Close the pubsub instance itself
            #             print("Redis PubSub instance closed.")
            #         except Exception as e:
            #             print(f"Error closing Redis PubSub instance: {e}")
            print("SSE Stream closed (Redis).")
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

# f1_backend/app/main.py
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware

from sqlmodel import Session # Add this if not already present

# --- Make sure these imports match your current setup ---
from .database import SessionDep, create_db_and_tables, engine # SQLModel engine
# from .schedule_manager import manage_f1_connection, load_schedule # If using scheduler
from .f1_websocket_client import f1_data_listener 
# --- End imports section ---


# Global variable to hold the F1 listener task
f1_listener_task_handle: Optional[asyncio.Task] = None
# schedule_manager_task_handle: Optional[asyncio.Task] = None # If using scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ===== Startup Logic =====
    print("Application startup (SQLModel): Initializing resources...")
    global f1_listener_task_handle

    print("Creating SQLModel database tables (if they don't exist)...")
    create_db_and_tables()
    print("SQLModel Database tables checked/created.")
    
    if not ('schedule_manager_task_handle' in globals() and globals()['schedule_manager_task_handle']):
        print("Starting F1 Data Listener task directly (SQLModel)...")
        f1_listener_task_handle = asyncio.create_task(f1_data_listener())
        print("F1 Data Listener task started (SQLModel - connecting to simulator/F1 source).")

    print("Application startup complete (SQLModel).")
    yield
    # ===== Shutdown Logic =====
    print("Application shutdown (SQLModel): Cleaning up resources...")

    if f1_listener_task_handle and not f1_listener_task_handle.done():
        print("Cancelling direct F1 Data Listener task (SQLModel)...")
        f1_listener_task_handle.cancel()
        try:
            await f1_listener_task_handle
        except asyncio.CancelledError:
            print("Direct F1 Data Listener task successfully cancelled (SQLModel).")
        except Exception as e:
            print(f"Error during direct F1 Data Listener task cancellation (SQLModel): {e}")

    if engine: # SQLModel engine from .database
        print("Disposing of SQLModel database engine...")
        engine.dispose() # Dispose the async engine
        print("SQLModel Database engine disposed.")
    
    print("Application shutdown complete (SQLModel).")

app = FastAPI(title="F1 Live Data Backend (SQLModel)", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Your SSE and other API endpoints will go here ---
# Example SSE endpoint (conceptual, needs full implementation)
from .models import F1MessageBase, LapBase
from .crud import get_f1_messages, get_laps
from fastapi.responses import StreamingResponse
from fastapi import Request, Depends
from datetime import datetime, timedelta, timezone

async def sse_sqlmodel_event_stream(
    db: SessionDep,
    delay_seconds: int = 0,
    # ... other params
):
    last_sent_backend_timestamp = datetime.min.replace(tzinfo=timezone.utc)

    # 1. Send historical data
    effective_current_time = datetime.now(timezone.utc) - timedelta(seconds=delay_seconds)
    initial_messages = get_f1_messages(
        session=db,
        until_backend_timestamp=effective_current_time,
        limit=10000 # Add a sensible limit or pagination for very large histories
    )
    initial_laps = get_laps(
        session=db,
        until_backend_timestamp=effective_current_time,
        limit=10000 # Add a sensible limit or pagination for very large histories
    )
    for msg_model in initial_messages:
        # Convert SQLModel instance to dict for JSON serialization, or use .model_dump_json()
        event_data = F1MessageBase.model_validate(msg_model).model_dump_json()
        yield f"data: {event_data}\n\n"
        
        retrieved_timestamp = msg_model.backend_received_at
        if retrieved_timestamp.tzinfo is None:
            retrieved_timestamp = retrieved_timestamp.replace(tzinfo=timezone.utc)

        if retrieved_timestamp > last_sent_backend_timestamp:
             last_sent_backend_timestamp = retrieved_timestamp
        await asyncio.sleep(0.001)

    # Send initial laps
    lap_payload = [LapBase.model_validate(lap).model_dump() for lap in initial_laps]
    lap_event_data = F1MessageBase(
        type="LapData",
        payload=lap_payload
    ).model_dump_json()
    yield f"data: {lap_event_data}\n\n"
    last_sent_lap_timestamp = effective_current_time
    await asyncio.sleep(0.001)
    
    # 2. Stream new data
    while True:
        threshold_time = datetime.now(timezone.utc) - timedelta(seconds=delay_seconds)
        new_messages = get_f1_messages(
            session=db,
            since_backend_timestamp=last_sent_backend_timestamp,
            until_backend_timestamp=threshold_time, # Only send if older than (now - delay)
            limit=1000
        )
        if new_messages:
            for msg_model in new_messages:
                event_data = F1MessageBase.model_validate(msg_model).model_dump_json()
                yield f"data: {event_data}\n\n"
                
                retrieved_timestamp = msg_model.backend_received_at
                if retrieved_timestamp.tzinfo is None:
                    retrieved_timestamp = retrieved_timestamp.replace(tzinfo=timezone.utc)

                if retrieved_timestamp > last_sent_backend_timestamp:
                    last_sent_backend_timestamp = retrieved_timestamp
                await asyncio.sleep(0.001)

        # Stream new laps
        new_laps = get_laps(
            session=db,
            since_backend_timestamp=last_sent_lap_timestamp,
            until_backend_timestamp=threshold_time,
            limit=1000
        )
        last_sent_lap_timestamp = threshold_time
        if new_laps:
            lap_payload = [LapBase.model_validate(lap).model_dump() for lap in new_laps]
            lap_event_data = F1MessageBase(
                type="LapData",
                payload=lap_payload
            ).model_dump_json()
            yield f"data: {lap_event_data}\n\n"

        await asyncio.sleep(0.1) # Poll DB

@app.get("/f1-stream-sqlmodel/", response_model=None) # SSE doesn't use response_model here
async def stream_f1_data_sqlmodel(
    request: Request,
    session: SessionDep,
    delay_seconds: int = 0,
):
    # ... (similar to previous SSE endpoint, but using sse_sqlmodel_event_stream)
    async def event_generator():
        try:
            async for event_chunk in sse_sqlmodel_event_stream(session, delay_seconds):
                if await request.is_disconnected():
                    print("Client disconnected from SSE stream (SQLModel).")
                    break
                yield event_chunk
        except asyncio.CancelledError:
            print("SSE stream cancelled on server side (SQLModel).")
        finally:
            print("SSE Stream closed (SQLModel).")
    return StreamingResponse(event_generator(), media_type="text/event-stream")
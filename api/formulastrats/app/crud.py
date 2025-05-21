# f1_backend/app/crud.py
import json
from datetime import datetime, timezone
from typing import List, Optional
from sqlmodel import Session, select
from sqlmodel.ext.asyncio.session import AsyncSession

from .models import F1Message, Lap

def parse_iso_timestamp_to_utc(timestamp_str: str) -> Optional[datetime]:
    """Parses an ISO 8601 timestamp string to a UTC timezone-aware datetime object."""
    try:
        if timestamp_str.endswith("Z"):
            # Python's fromisoformat handles 'Z' correctly for versions 3.11+
            # For older versions, or to be explicit:
            # timestamp_str = timestamp_str[:-1] + "+00:00"
            dt_obj = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        else:
            dt_obj = datetime.fromisoformat(timestamp_str)
        
        # Ensure it's UTC if naive, or convert to UTC if it has other timezone
        if dt_obj.tzinfo is None:
            return dt_obj.replace(tzinfo=timezone.utc)
        return dt_obj.astimezone(timezone.utc)
    except ValueError:
        print(f"Error parsing source timestamp: '{timestamp_str}'")
        return None

def create_f1_message(
    session: Session,
    message_type: str,
    payload: dict,
    source_timestamp_str: str
) -> F1Message:
    parsed_source_ts = parse_iso_timestamp_to_utc(source_timestamp_str)
    if not parsed_source_ts:
        # Decide handling: raise error, or store with None timestamp
        # For now, let's proceed with None if parsing fails, F1Message model allows Optional
        print(f"Warning: Could not parse source_timestamp_str: {source_timestamp_str}. Storing as None.")

    # Create the database model instance
    db_f1_message = F1Message(
        type=message_type,
        payload=payload,
        source_timestamp_str=source_timestamp_str,
        source_timestamp=parsed_source_ts, # Store the parsed datetime
        # backend_received_at is set by default_factory in F1Message
    )

    session.add(db_f1_message)
    session.commit()
    session.refresh(db_f1_message)
    # print(f"SQLModel: Stored F1 message ID {db_f1_message.id} (Type: {db_f1_message.message_type})")
    return db_f1_message


def get_f1_messages(
    session: Session,
    skip: int = 0,
    limit: int = 100,
    message_type_filter: Optional[str] = None,
    since_backend_timestamp: Optional[datetime] = None,
    until_backend_timestamp: Optional[datetime] = None, # For initial load with delay
) -> List[F1Message]:
    statement = select(F1Message).offset(skip).limit(limit).order_by(F1Message.backend_received_at.asc())
    
    if message_type_filter:
        statement = statement.where(F1Message.type == message_type_filter)
    if since_backend_timestamp:
        statement = statement.where(F1Message.backend_received_at > since_backend_timestamp)
    if until_backend_timestamp: # Used for fetching historical data up to a point
        statement = statement.where(F1Message.backend_received_at <= until_backend_timestamp)
        
    results = session.exec(statement)
    messages = results.all()
    return list(messages)

def create_lap(
    session: Session,
    lap_number: int,
    lap_time: str,
    racing_number: str
) -> Lap:
    # Create the database model instance
    db_lap = Lap(
        LapNumber=lap_number,
        LapTime=lap_time,
        RacingNumber=racing_number
    )

    session.add(db_lap)
    session.commit()
    session.refresh(db_lap)
    # print(f"SQLModel: Stored F1 message ID {db_f1_message.id} (Type: {db_f1_message.message_type})")
    return db_lap

def get_laps(
    session: Session,
    skip: int = 0,
    limit: int = 100,
    racing_number_filter: Optional[str] = None,
    min_lap_time: Optional[str] = None,
    max_lap_time: Optional[str] = None,
    since_backend_timestamp: Optional[datetime] = None,
    until_backend_timestamp: Optional[datetime] = None
) -> List[Lap]:
    """
    Retrieves laps from the database with optional filters for racing number, lap time range, and timestamp.
    """
    statement = select(Lap).offset(skip).limit(limit).order_by(Lap.LapNumber.asc())
    
    if racing_number_filter:
        statement = statement.where(Lap.RacingNumber == racing_number_filter)
    if min_lap_time:
        statement = statement.where(Lap.LapTime >= min_lap_time)
    if max_lap_time:
        statement = statement.where(Lap.LapTime <= max_lap_time)
    if since_backend_timestamp:
        statement = statement.where(Lap.backend_received_at > since_backend_timestamp)
    if until_backend_timestamp:
        statement = statement.where(Lap.backend_received_at <= until_backend_timestamp)
        
    results = session.exec(statement)
    laps = results.all()
    return list(laps)
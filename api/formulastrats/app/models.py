# f1_backend/app/models.py
from datetime import datetime, timezone # Modified import
from typing import List, Optional, Dict, Any, Union
from sqlmodel import Field, SQLModel, JSON, Column # Import JSON and Column for JSON type
from pydantic import field_validator

class F1MessageBase(SQLModel):
    type: str = Field(index=True)
    payload: Union[Dict[str, Any], List[Any]] = Field(sa_column=Column(JSON))

class F1Message(F1MessageBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    source_timestamp_str: str = Field(alias="sourceTimestampString") # Keep the original string for robustness
    source_timestamp: Optional[datetime] = Field(default=None, index=True) # Parsed datetime
    backend_received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True) # Modified default_factory

class LapBase(SQLModel):
    LapNumber: int
    LapTime: str
    RacingNumber: str

class Lap(LapBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    backend_received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True) # Modified default_factory

# You can define models for ProcessedData similarly if needed
# class ProcessedF1DataBase(SQLModel):
#     raw_message_id: Optional[int] = Field(default=None, foreign_key="f1_messages.id", index=True)
#     processing_type: str = Field(index=True)
#     data: Dict[Any, Any] = Field(sa_column=Column(JSON))
#     processed_at: datetime = Field(default_factory=datetime.utcnow)

# class ProcessedF1Data(ProcessedF1DataBase, table=True):
#     __tablename__ = "processed_f1_data"
#     id: Optional[int] = Field(default=None, primary_key=True, index=True)

# class ProcessedF1DataCreate(ProcessedF1DataBase):
#     pass

# class ProcessedF1DataRead(ProcessedF1DataBase):
#     id: int
# f1_backend/app/database.py
import os
from typing import Annotated
from fastapi import Depends
from sqlmodel import SQLModel, Session, create_engine # No need to alias if not conflicting elsewhere
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./f1_data_sqlmodel.db")

engine = create_engine(
    DATABASE_URL,
    echo=False, # Set to True for debugging SQL queries
    connect_args={"check_same_thread": False}
)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    print("SQLModel database tables checked/created.")

def get_session():
    with Session(engine) as session:
        yield session

SessionDep = Annotated[Session, Depends(get_session)]
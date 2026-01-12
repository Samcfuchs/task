import sqlite3
import json
from datetime import datetime
from sqlalchemy import create_engine, Integer, JSON, Column, Sequence, Text, String, DateTime, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv
import os

from models import Snapshot

DB_PATH = 'snapshots.db'

EntityBase = declarative_base()

class TableSnapshot(EntityBase):
    __tablename__ = "snapshots"
    id = Column(Integer, Sequence("item_id_seq"), primary_key=True, nullable=False)
    user_id = Column(String(50), default='sam')
    schema_version = Column(Integer, default=0)
    snapshot = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

def get_supa_engine():
    load_dotenv()
    # Fetch variables
    USER = os.getenv("user")
    PASSWORD = os.getenv("password")
    HOST = os.getenv("host")
    PORT = os.getenv("port")
    DBNAME = os.getenv("dbname")

    # Construct the SQLAlchemy connection string
    DATABASE_URL = f"postgresql+psycopg2://{USER}:{PASSWORD}@{HOST}:{PORT}/{DBNAME}?sslmode=require"
    #print(DATABASE_URL)

    # Create the SQLAlchemy engine
    engine = create_engine(DATABASE_URL)

    return engine

#engine = create_engine(f"sqlite:///{DB_PATH}", echo=True)
engine = get_supa_engine()
Session = sessionmaker(bind=engine)
session = Session()

# Creates tables
EntityBase.metadata.create_all(engine)


def insert(snap: Snapshot):
    ts = TableSnapshot()
    ts.snapshot = snap.model_dump()['tasks']
    ts.schema_version = snap.schemaVersion

    session.add(ts)
    session.commit()
    print("Inserted snapshot")

def get_snapshot():
    items = session.query(TableSnapshot).order_by(TableSnapshot.id.desc())
    print(items)
    return items

def get_latest_snapshot():
    items = session.query(TableSnapshot).order_by(TableSnapshot.id.desc()).first()
    print(items)
    return items


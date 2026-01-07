#!./env/bin/python3

from typing import Annotated
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Field, SQLModel, Session, create_engine, select
import database
import logging
import sqlite3
import json

from models import Snapshot


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

logger = logging.getLogger(__name__)

app = FastAPI(lifespan=lifespan)

origins = [
    'http://localhost',
    'http://127.0.0.1',
    'http://127.0.0.1:35296',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5172',
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allows all headers
)

def load_snapshot():
    return database.get_snapshot()[0]


@app.post("/save")
def save(snapshot: Snapshot) -> Snapshot:
    logger.info("Save running")
    database.insert(snapshot)

    return snapshot


@app.get("/load")
def load():
    snap = database.get_latest_snapshot()
    return snap

from typing import Dict, List, Literal
from pydantic import BaseModel
from sqlmodel import Field, Session, SQLModel, create_engine, select

class Task(BaseModel):
    id: str
    title: str
    description: str
    priority: int
    status: Literal["not started", "complete"]
    isBlocked: bool
    isExternal: bool
    dependsOn: List[str]


class Snapshot(BaseModel):
    schemaVersion: int
    tasks: Dict[str, Task]


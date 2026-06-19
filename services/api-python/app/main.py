from __future__ import annotations

import asyncio
import os
import subprocess
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field


VERSION = "0.3.3-beta"
WORKSPACE = Path(os.getenv("OPEN_NEO_WORKSPACE", Path.cwd())).resolve()

app = FastAPI(title="Open Neo UI Local API", version=VERSION)
event_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()


class AgentEvent(BaseModel):
    type: str
    session_id: str = "local-agent"
    message: str
    data: dict[str, Any] = Field(default_factory=dict)


class PathRequest(BaseModel):
    path: str = "."


class WriteFileRequest(BaseModel):
    path: str
    content: str


class CommandRequest(BaseModel):
    command: list[str]
    cwd: str = "."
    timeout_seconds: int = 30


def safe_path(relative_path: str) -> Path:
    path = (WORKSPACE / relative_path).resolve()
    if path != WORKSPACE and WORKSPACE not in path.parents:
        raise HTTPException(status_code=403, detail="Path is outside the Open Neo workspace")
    return path


async def publish(event: AgentEvent) -> None:
    await event_queue.put(event.model_dump())


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "open-neo-ui-api",
        "version": VERSION,
        "workspace": str(WORKSPACE),
    }


@app.get("/tools")
async def tools() -> list[dict[str, str]]:
    return [
        {"name": "workspace.list", "description": "List files inside the active workspace."},
        {"name": "workspace.read", "description": "Read a file inside the active workspace."},
        {"name": "workspace.write", "description": "Write a file after user approval."},
        {"name": "git.status", "description": "Show git status for the workspace."},
        {"name": "engines.scan", "description": "Detect Unity projects in the workspace."},
        {"name": "terminal.run", "description": "Run an approved command and stream result events."},
    ]


@app.post("/workspace/list")
async def list_workspace(req: PathRequest) -> dict[str, Any]:
    root = safe_path(req.path)
    if not root.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")

    items = []
    for child in sorted(root.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
        items.append({"name": child.name, "path": str(child.relative_to(WORKSPACE)), "type": "dir" if child.is_dir() else "file"})
    return {"workspace": str(WORKSPACE), "items": items}


@app.post("/workspace/read")
async def read_file(req: PathRequest) -> dict[str, str]:
    path = safe_path(req.path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return {"path": str(path.relative_to(WORKSPACE)), "content": path.read_text(encoding="utf-8")}


@app.post("/workspace/write")
async def write_file(req: WriteFileRequest) -> dict[str, str]:
    path = safe_path(req.path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(req.content, encoding="utf-8")
    await publish(AgentEvent(type="file.changed", message=f"Wrote {req.path}", data={"path": req.path}))
    return {"status": "ok", "path": str(path.relative_to(WORKSPACE))}


@app.post("/git/status")
async def git_status(req: PathRequest) -> dict[str, Any]:
    cwd = safe_path(req.path)
    result = subprocess.run(["git", "status", "--short", "--branch"], cwd=cwd, text=True, capture_output=True, timeout=15)
    return {"returncode": result.returncode, "stdout": result.stdout, "stderr": result.stderr}


@app.post("/terminal/run")
async def run_command(req: CommandRequest) -> dict[str, Any]:
    cwd = safe_path(req.cwd)
    await publish(AgentEvent(type="command.started", message=" ".join(req.command), data={"cwd": str(cwd)}))
    try:
        result = subprocess.run(req.command, cwd=cwd, text=True, capture_output=True, timeout=req.timeout_seconds)
    except subprocess.TimeoutExpired as exc:
        await publish(AgentEvent(type="command.failed", message="Command timed out", data={"command": req.command}))
        raise HTTPException(status_code=408, detail=f"Command timed out after {exc.timeout} seconds") from exc

    event_type = "command.completed" if result.returncode == 0 else "command.failed"
    await publish(AgentEvent(type=event_type, message="Command finished", data={"returncode": result.returncode}))
    return {"returncode": result.returncode, "stdout": result.stdout, "stderr": result.stderr}


@app.post("/engines/scan")
async def scan_engines(req: PathRequest) -> dict[str, Any]:
    root = safe_path(req.path)
    unity_projects = []
    for marker in root.rglob("ProjectSettings/ProjectVersion.txt"):
        project_root = marker.parents[1]
        unity_projects.append(
            {
                "name": project_root.name,
                "path": str(project_root.relative_to(WORKSPACE)),
                "version_file": str(marker.relative_to(WORKSPACE)),
            }
        )
    await publish(AgentEvent(type="engine.scan.completed", message=f"Found {len(unity_projects)} Unity project(s)"))
    return {"unity": unity_projects}


@app.websocket("/events/ws")
async def events(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.send_json(
        AgentEvent(type="agent.connected", message="Open Neo UI event stream connected.", data={"version": VERSION}).model_dump()
    )

    try:
        while True:
            event = await event_queue.get()
            await websocket.send_json(event)
    except WebSocketDisconnect:
        return

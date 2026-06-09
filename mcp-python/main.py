from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any
import os
import httpx
import asyncpg
import subprocess

app = FastAPI(title="Neotek MCP Server", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://neotek:neotek123@postgres:5432/neotekdb")

TOOLS = {
    "read_file": "Lê o conteúdo de um arquivo no servidor",
    "write_file": "Escreve conteúdo em um arquivo",
    "run_shell": "Executa um comando shell (seguro, sem sudo)",
    "web_search": "Busca na web usando DuckDuckGo",
    "db_query": "Executa uma query SELECT no banco de dados",
}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "mcp-python"}


@app.get("/tools")
async def list_tools():
    return {"tools": [{"name": k, "description": v} for k, v in TOOLS.items()]}


class ToolInput(BaseModel):
    params: dict[str, Any] = {}


@app.post("/tools/read_file")
async def tool_read_file(body: ToolInput):
    path = body.params.get("path", "")
    if not path:
        raise HTTPException(400, "path obrigatório")
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"content": content, "path": path}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/tools/write_file")
async def tool_write_file(body: ToolInput):
    path = body.params.get("path", "")
    content = body.params.get("content", "")
    if not path:
        raise HTTPException(400, "path obrigatório")
    try:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return {"success": True, "path": path}
    except Exception as e:
        raise HTTPException(500, str(e))


ALLOWED_COMMANDS = ["ls", "pwd", "cat", "echo", "python3", "pip", "git"]

@app.post("/tools/run_shell")
async def tool_run_shell(body: ToolInput):
    cmd = body.params.get("command", "")
    if not cmd:
        raise HTTPException(400, "command obrigatório")
    first = cmd.strip().split()[0]
    if first not in ALLOWED_COMMANDS:
        raise HTTPException(403, f"Comando '{first}' não permitido")
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=15
        )
        return {"stdout": result.stdout, "stderr": result.stderr, "code": result.returncode}
    except subprocess.TimeoutExpired:
        raise HTTPException(408, "Timeout ao executar comando")


@app.post("/tools/web_search")
async def tool_web_search(body: ToolInput):
    query = body.params.get("query", "")
    if not query:
        raise HTTPException(400, "query obrigatório")
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_html": 1},
            timeout=10,
        )
        data = resp.json()
    return {
        "abstract": data.get("AbstractText", ""),
        "source": data.get("AbstractSource", ""),
        "url": data.get("AbstractURL", ""),
        "related": [r.get("Text", "") for r in data.get("RelatedTopics", [])[:5]],
    }


@app.post("/tools/db_query")
async def tool_db_query(body: ToolInput):
    sql = body.params.get("sql", "")
    if not sql or not sql.strip().upper().startswith("SELECT"):
        raise HTTPException(400, "Apenas SELECT é permitido")
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        rows = await conn.fetch(sql)
        await conn.close()
        return {"rows": [dict(r) for r in rows], "count": len(rows)}
    except Exception as e:
        raise HTTPException(500, str(e))

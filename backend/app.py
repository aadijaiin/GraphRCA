"""HTTP API: graph snapshot, alerts, provenance and the investigation event stream (docs/events.md).

    uvicorn app:app --reload --port 8000      (from backend/)
"""
import asyncio
import json
import os
import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from db import get_client
from ingestor import ingest
from llm import BACKENDS, default_backend, has_credentials
from orchestrator import investigate
from tools import get_artifacts, run

TENANTS = set(os.getenv("TENANTS", "dashmart,freshloop").split(","))
DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

app = FastAPI(title="DashMart Brain")


def tenant_graph(tenant: str) -> str:
    """The graph name always comes from the request, checked against the tenant whitelist."""
    if tenant not in TENANTS:
        raise HTTPException(404, f"unknown tenant {tenant}")
    return tenant


@app.get("/api/health")
def health():
    graphs = get_client().list_graphs()  # fails loudly if FalkorDB is down: there is no other store
    return {"ok": True, "graphs": [g for g in graphs if g in TENANTS]}


@app.get("/api/backends")
def backends():
    """Model backends the UI can offer, from this server's configuration. Never returns keys."""
    local = os.getenv("LOCAL_MODEL_URL")
    out = [{"id": "scripted", "label": "Scripted (no model)", "available": True},
           {"id": "local", "label": f"Server · {os.getenv('LOCAL_MODEL', 'gpt-oss:20b')}", "available": bool(local),
            "hint": None if local else "set LOCAL_MODEL_URL, LOCAL_MODEL_KEY and LOCAL_MODEL in .env"}]
    if has_credentials():  # only offered when this server actually has Anthropic credentials
        out.append({"id": "claude", "label": f"Claude · {os.getenv('BRAIN_MODEL', 'claude-opus-5-5')}", "available": True})
    return out


@app.get("/api/graph")
def graph(tenant: str = "dashmart"):
    g = tenant_graph(tenant)
    return {"nodes": run(g, "ui_nodes"), "links": run(g, "ui_edges")}


@app.get("/api/alerts")
def alerts(tenant: str = "dashmart"):
    return run(tenant_graph(tenant), "ui_alerts")


@app.get("/api/artifacts")
def artifacts(ids: str = Query(..., description="comma-separated Artifact ids"), tenant: str = "dashmart"):
    return get_artifacts(tenant_graph(tenant), [i for i in ids.split(",") if i])


class Event(BaseModel):
    text: str
    author_id: str
    kind: str = "slack"
    channel: str = "#live-events"


@app.post("/api/events")
def post_event(event: Event, tenant: str = "dashmart"):
    """Ingestor: validate and write one event. 422 with the reasons if it is rejected (graph unchanged)."""
    result = ingest(tenant_graph(tenant), event.text, event.author_id, event.kind, event.channel)
    if not result["ok"]:
        raise HTTPException(422, {"errors": result["errors"]})
    return result


@app.get("/api/investigate/{alert_id}")
async def investigate_stream(alert_id: str, tenant: str = "dashmart", backend: str | None = None):
    g = tenant_graph(tenant)
    if backend not in (None, *BACKENDS):
        raise HTTPException(400, f"backend must be one of {list(BACKENDS)}")
    try:
        model = BACKENDS.get(backend, default_backend)()
    except Exception as e:  # no Anthropic credentials, or the local model server is unreachable
        raise HTTPException(400, f"backend unavailable: {e}")
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    done = object()

    def work():
        try:
            investigate(g, alert_id, model, emit=lambda ev: loop.call_soon_threadsafe(queue.put_nowait, ev))
        except Exception as e:
            loop.call_soon_threadsafe(queue.put_nowait, {"type": "error", "data": {"message": str(e)}})
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, done)

    threading.Thread(target=work, daemon=True).start()

    async def stream():
        while (ev := await queue.get()) is not done:
            yield f"event: {ev['type']}\ndata: {json.dumps(ev)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


if DIST.exists():  # production: serve the built frontend from the same origin
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = DIST / path
        return FileResponse(f if path and f.is_file() else DIST / "index.html")

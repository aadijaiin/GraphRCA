"""HTTP API: graph snapshot, alerts, provenance and the investigation event stream (docs/events.md).

    uvicorn app:app --reload --port 8000      (from backend/)
"""
import asyncio
import json
import os
import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from db import get_client
from llm import ClaudeBackend, ScriptedBackend, default_backend
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


@app.get("/api/investigate/{alert_id}")
async def investigate_stream(alert_id: str, tenant: str = "dashmart", backend: str | None = None):
    g = tenant_graph(tenant)
    if backend not in (None, "claude", "scripted"):
        raise HTTPException(400, "backend must be claude or scripted")
    try:
        model = {"claude": ClaudeBackend, "scripted": ScriptedBackend}.get(backend, default_backend)()
    except Exception as e:  # e.g. no Anthropic credentials configured
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

"""MCP server over the same graph tools the agents use, so any MCP client (Claude Desktop, Claude Code, another
agent) can investigate DashMart through FalkorDB. Every tool takes the tenant explicitly.

    python mcp_server.py                      # stdio transport
    claude mcp add graphrca -- python /path/to/backend/mcp_server.py
"""
import os

from mcp.server.mcpserver import MCPServer

from ingestor import ingest
from llm import BACKENDS, default_backend
from orchestrator import investigate as run_investigation
from tools import TOOLS

TENANTS = set(os.getenv("TENANTS", "dashmart,freshloop").split(","))

server = MCPServer("graphrca", instructions=(
    "Graph tools over DashMart, a fictional quick-commerce company (synthetic data) stored in FalkorDB. "
    "Start from an alert id (list them with list_alerts), then trace_decision, find_amplifiers, equipment_status "
    "and find_expert. Or call investigate to run the full orchestrator with its department agents."))


def _call(tenant, name, **args):
    if tenant not in TENANTS:
        return {"error": f"unknown tenant {tenant}"}
    r = TOOLS[name](tenant, **args)
    return {"result": r["result"], "sources": r["sources"], "error": r["error"]}


@server.tool()
def list_alerts(tenant: str = "dashmart") -> dict:
    """Alerts in the tenant, newest first."""
    from tools import run
    return {"alerts": run(tenant, "ui_alerts")} if tenant in TENANTS else {"error": f"unknown tenant {tenant}"}


@server.tool()
def get_alert(alert_id: str, tenant: str = "dashmart") -> dict:
    """The alert's store, SKU, metric and values."""
    return _call(tenant, "get_alert", alert_id=alert_id)


@server.tool()
def trace_decision(alert_id: str, tenant: str = "dashmart") -> dict:
    """Latest decision that moved the alert's SKU in its store before the alert, with author, causes and sources."""
    return _call(tenant, "trace_decision", alert_id=alert_id)


@server.tool()
def find_amplifiers(alert_id: str, tenant: str = "dashmart") -> dict:
    """Active campaigns promoting the alert's SKU in its store, started before the alert, with owners."""
    return _call(tenant, "find_amplifiers", alert_id=alert_id)


@server.tool()
def equipment_status(store_id: str, kind: str | None = None, tenant: str = "dashmart") -> dict:
    """Equipment at a store (optionally one kind: chiller, freezer, rack, scanner) with owners and tickets."""
    return _call(tenant, "equipment_status", store_id=store_id, kind=kind)


@server.tool()
def find_expert(entity_id: str, tenant: str = "dashmart") -> dict:
    """People ranked by work history on an entity."""
    return _call(tenant, "find_expert", entity_id=entity_id)


@server.tool()
def impact_of(supplier_id: str, tenant: str = "dashmart") -> dict:
    """What a late supplier breaks: stores, SKUs, active campaigns and who to tell."""
    return _call(tenant, "impact_of", supplier_id=supplier_id)


@server.tool()
def connect_path(from_id: str, to_id: str, tenant: str = "dashmart") -> dict:
    """Shortest path between two nodes in either direction (a link, not proof of cause)."""
    return _call(tenant, "connect_path", from_id=from_id, to_id=to_id)


@server.tool()
def rank_people(investigation_id: str, tenant: str = "dashmart") -> dict:
    """Who is most connected to the entities an investigation's Findings cite (degree, PageRank tie-break)."""
    return _call(tenant, "rank_people", investigation_id=investigation_id)


@server.tool()
def search_artifacts(text: str, tenant: str = "dashmart") -> dict:
    """Full-text search over messages, SOPs, ticket text, ticket titles and SKU names."""
    return _call(tenant, "search_artifacts", text=text)


@server.tool()
def investigate(alert_id: str, tenant: str = "dashmart", backend: str = "default") -> dict:
    """Run the orchestrator and department agents on an alert. backend: default, scripted, claude or local."""
    if tenant not in TENANTS:
        return {"error": f"unknown tenant {tenant}"}
    model = BACKENDS[backend]() if backend in BACKENDS else default_backend()
    answer, inv = run_investigation(tenant, alert_id, model)
    return {"investigation_id": inv.id, "backend": model.name, "answer": answer}


@server.tool()
def ingest_event(text: str, author_id: str, tenant: str = "dashmart") -> dict:
    """Validate and write one Slack message or ticket update; an alert-shaped message creates an Alert."""
    if tenant not in TENANTS:
        return {"error": f"unknown tenant {tenant}"}
    r = ingest(tenant, text, author_id)
    return {k: r[k] for k in ("ok", "errors", "artifact_id", "alert_id") if k in r}


if __name__ == "__main__":
    server.run("stdio")

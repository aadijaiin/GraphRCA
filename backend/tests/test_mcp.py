"""The MCP server exposes the graph tools and returns the same results as the in-process tools."""
import asyncio
import json

import mcp_server


def call(name, args):
    r = asyncio.run(mcp_server.server.call_tool(name, args))
    assert not r.is_error
    return json.loads(r.content[0].text)


def test_lists_graph_tools():
    names = {t.name for t in asyncio.run(mcp_server.server.list_tools())}
    assert {"trace_decision", "find_amplifiers", "equipment_status", "investigate", "ingest_event"} <= names


def test_call_over_mcp(graph, monkeypatch):
    monkeypatch.setattr(mcp_server, "TENANTS", {graph})
    out = call("trace_decision", {"alert_id": "ALT-001", "tenant": graph})
    assert out["result"]["decision"]["id"] == "DEC-209" and "ART-A02" in out["sources"]
    assert call("get_alert", {"alert_id": "ALT-001", "tenant": "dashmart"})["error"] == "unknown tenant dashmart"


def test_investigate_over_mcp(graph, monkeypatch):
    monkeypatch.setattr(mcp_server, "TENANTS", {graph})
    out = call("investigate", {"alert_id": "ALT-001", "tenant": graph, "backend": "scripted"})
    assert out["answer"]["root_cause"]["id"] == "EQ-SD04-CHA1" and out["backend"] == "scripted"

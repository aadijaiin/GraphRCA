"""Tenant isolation: each company is its own FalkorDB graph; nothing crosses, including memory."""
import pytest

from db import get_graph
from llm import ScriptedBackend
from orchestrator import investigate
from tools import TOOLS, run

import freshloop
import generate

FL = "test_freshloop"


@pytest.fixture(scope="module")
def fl_graph(graph):  # depends on the dashmart test graph so both tenants exist at once
    b, _ = freshloop.build()
    generate.load(FL, b)
    yield FL
    get_graph(FL).delete()


def test_dashmart_ids_invisible_in_freshloop(fl_graph):
    for name, args in [("get_alert", {"alert_id": "ALT-001"}), ("trace_decision", {"alert_id": "ALT-001"}),
                       ("find_amplifiers", {"alert_id": "ALT-001"}), ("find_expert", {"entity_id": "EQ-SD04-CHA1"}),
                       ("equipment_status", {"store_id": "SD-04", "kind": None}), ("impact_of", {"supplier_id": "SUP-01"})]:
        r = TOOLS[name](fl_graph, **args)
        assert r["touched"]["nodes"] in ([], [args.get("alert_id") or args.get("entity_id") or args.get("store_id")]), name
        assert not r["sources"], name
    hits = TOOLS["search_artifacts"](fl_graph, text="buttermilk chiller Summer Coolers")["result"]["hits"]
    assert hits == []


def test_freshloop_ids_invisible_in_dashmart(graph, fl_graph):
    assert run(graph, "check_ids", ids=["FLA-001", "FLP-01", "FL-01"]) == [
        {"id": "FLA-001", "label": None}, {"id": "FLP-01", "label": None}, {"id": "FL-01", "label": None}]


def test_freshloop_investigation_and_memory_stay_home(graph, fl_graph):
    investigate(graph, "ALT-001", ScriptedBackend(), save_run=False)  # dashmart has memories now
    answer, inv = investigate(fl_graph, "FLA-001", ScriptedBackend(), save_run=False)
    assert answer["root_cause"]["id"] == "FLEQ-FL-01-RACK1" and answer["amplifier"]["id"] == "FLC-01"
    recalled = next(e["data"] for e in inv.events if e["type"] == "memory_recalled")
    assert recalled["memories"] == []  # no dashmart memory leaks in
    cited = {n for f in inv.findings().values() for n in f["cites"]}
    assert cited and all(n.startswith("FL") for n in cited)

"""The generator is deterministic and plants the chains the scenarios depend on."""
import json

import generate
from conftest import ROOT
from tools import run


def test_deterministic():
    a, _, _ = generate.build()
    b, _, _ = generate.build()
    assert a.nodes == b.nodes and a.edges == b.edges


def test_counts_match_plan(graph):
    counts = {r["label"]: r["n"] for r in
              [dict(zip(["label", "n"], row)) for row in
               __import__("db").get_graph(graph).query("MATCH (n) RETURN labels(n)[0], count(n)").result_set]}
    assert counts == {"Person": 30, "Store": 6, "SKU": 60, "Equipment": 24, "Supplier": 8, "Campaign": 12,
                      "Ticket": 40, "Decision": 25, "Artifact": 150, "Alert": 10}


def test_scenario_a_chain(graph):
    rows = run(graph, "trace_decision", alert_id="ALT-001")
    assert {r["cause_id"] for r in rows} == {"FAC-882", "EQ-SD04-CHA1"}
    ticket = next(r for r in rows if r["cause_id"] == "FAC-882")
    assert ticket["cause_owner_id"] is None and ticket["cause_status"] == "open"


def test_unique_ids_enforced(graph):
    import pytest
    from db import get_graph
    with pytest.raises(Exception):
        get_graph(graph).query("CREATE (:Ticket {id: 'FAC-882'})")


def test_eval_file_matches_generator():
    _, incidents, impact = generate.build()
    on_disk = json.loads((ROOT / "eval" / "incidents.json").read_text())
    assert on_disk["incidents"] == incidents and on_disk["impact_scenarios"] == [impact]

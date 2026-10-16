"""One test per tool against the seed, plus the full investigation on every seeded incident."""
import pytest

from tools import TOOLS


def ids(rows):
    return {r["id"] for r in rows}


def test_contract_shape(graph):
    r = TOOLS["get_alert"](graph, alert_id="ALT-001")
    assert set(r) == {"tool", "args", "result", "touched", "sources", "error"}
    assert r["error"] is None and set(r["touched"]) == {"nodes", "edges"}


def test_error_is_returned_not_raised(graph):
    r = TOOLS["get_alert"](graph, alert_id="NOPE")
    assert r["error"] and r["result"] is None


def test_search_finds_hero_thread(graph):
    r = TOOLS["search_artifacts"](graph, text="buttermilk back freezer")
    assert "ART-A02" in [h["id"] for h in r["result"]["hits"]]
    assert set(r["sources"]) <= set(r["touched"]["nodes"])


def test_trace_decision_ignores_other_store_history(graph):
    r = TOOLS["trace_decision"](graph, alert_id="ALT-001")["result"]
    assert r["decision"]["id"] == "DEC-209"  # not DEC-215, the same SKU at GG-03
    assert r["author"]["id"] == "PER-001"


def test_find_amplifiers_filters_sku_store_status(graph):
    r = TOOLS["find_amplifiers"](graph, alert_id="ALT-001")["result"]
    # CMP-02 same store other SKU, CMP-03 ended, CMP-04 other store: all rejected
    assert ids(r["campaigns"]) == {"CMP-01"}


def test_find_expert_ranks_history(graph):
    people = TOOLS["find_expert"](graph, entity_id="EQ-SD04-CHA1")["result"]["people"]
    assert people[0]["id"] == "PER-004" and people[0]["touches"] == 2
    assert any(p["id"] == "PER-003" and p["is_owner"] for p in people)


def test_touched_edges_are_real(graph):
    """Every edge a tool reports must exist in FalkorDB (the UI cannot draw a path the agent did not take)."""
    from db import get_graph
    g = get_graph(graph)
    for name, args in [("trace_decision", {"alert_id": "ALT-001"}), ("find_amplifiers", {"alert_id": "ALT-001"}),
                       ("find_expert", {"entity_id": "EQ-SD04-CHA1"}), ("get_alert", {"alert_id": "ALT-001"})]:
        for e in TOOLS[name](graph, **args)["touched"]["edges"]:
            q = f"MATCH ({{id: $f}})-[r:{e['type']}]->({{id: $t}}) RETURN count(r)"
            assert g.ro_query(q, {"f": e["from"], "t": e["to"]}).result_set[0][0] >= 1, (name, e)

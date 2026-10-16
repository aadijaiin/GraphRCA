"""One test per tool against the seed, plus the full investigation on every seeded incident."""
import pytest

from investigator import investigate, validate_answer
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


def test_validator_drops_uncited_claims():
    ans, dropped = validate_answer({"claims": [{"text": "a", "finding_ids": ["S1"]}, {"text": "b", "finding_ids": []}],
                                    "actions": [{"text": "c"}]})
    assert [c["text"] for c in ans["claims"]] == ["a"] and len(dropped) == 2


@pytest.mark.parametrize("alert_id", [f"ALT-{i:03d}" for i in range(1, 11)])
def test_investigation_matches_ground_truth(graph, truth, alert_id):
    t = truth[alert_id]
    answer, run = investigate(graph, alert_id)
    assert (answer["root_cause"] or {}).get("id") == t["root_cause"]
    want_amp = t["amplifier"] if t["variant"] == "fault_amplified" else None
    assert (answer["amplifier"] or {}).get("id") == want_amp
    cited = {s for c in answer["claims"] for s in c.get("sources", [])}
    assert set(t["required_evidence"]) <= cited
    assert all(c["finding_ids"] for c in answer["claims"] + answer["actions"])
    types = [e["type"] for e in run.events]
    assert types[0] == "investigation_started" and types[-1] == "answer_ready"

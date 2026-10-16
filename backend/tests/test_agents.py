"""Orchestrator and department agents (scripted backend), the validator, memory, and the Claude message loop."""
from types import SimpleNamespace

import pytest

import generate
from agents import DEPARTMENTS, Ctx, run_agent, validate_answer
from db import get_graph
from llm import AgentError, ClaudeBackend, ScriptedBackend
from orchestrator import investigate
from state import Investigation
from tools import TOOLS


def rounds(inv):
    return max([e["data"]["round"] for e in inv.events if e["type"] == "task_created"] or [0])


@pytest.mark.parametrize("alert_id", [f"ALT-{i:03d}" for i in range(1, 11)])
def test_multi_agent_matches_ground_truth(graph, truth, alert_id):
    t = truth[alert_id]
    answer, inv = investigate(graph, alert_id, ScriptedBackend(), save_run=False)
    assert (answer["root_cause"] or {}).get("id") == t["root_cause"]
    want_amp = t["amplifier"] if t["variant"] == "fault_amplified" else None
    assert (answer["amplifier"] or {}).get("id") == want_amp
    cited = {s for c in answer["claims"] for s in c["sources"]}
    assert set(t["required_evidence"]) <= cited
    types = [e["type"] for e in inv.events]
    assert types[0] == "investigation_started" and "answer_ready" in types


def test_departments_coordinate_through_graph(graph):
    """Tasks and Findings exist as nodes; Facilities is dispatched only after Store Ops' Finding names the unit."""
    answer, inv = investigate(graph, "ALT-002", ScriptedBackend(), save_run=False)
    g = get_graph(graph)
    tasks = g.ro_query("MATCH (t:Task)-[:PART_OF]->(:Investigation {id: $i}) RETURN t.department, t.round, t.status "
                       "ORDER BY t.round, t.department", {"i": inv.id}).result_set
    assert ["facilities", 2, "done"] in tasks and ["store_ops", 1, "done"] in tasks
    agents = {r[0] for r in g.ro_query("MATCH (f:Finding)-[:PART_OF]->(:Investigation {id: $i}) RETURN DISTINCT f.agent",
                                       {"i": inv.id}).result_set}
    assert {"orchestrator", "store_ops", "growth", "facilities"} <= agents
    dangling = g.ro_query("MATCH (f:Finding)-[:PART_OF]->(:Investigation {id: $i}) WHERE NOT (f)-[:CITES]->() "
                          "RETURN count(f)", {"i": inv.id}).result_set[0][0]
    assert dangling == 0


def test_validator_rejects_foreign_and_uncited_ids(graph):
    answer, inv = investigate(graph, "ALT-001", ScriptedBackend(), save_run=False)
    real = answer["claims"][1]["finding_ids"]
    ctx = Ctx(graph, inv, ScriptedBackend(), {"store_id": "SD-04"})
    raw = {"summary": "x", "root_cause_id": "EQ-GG03-CHA1", "amplifier_id": None,
           "claims": [{"text": "ok", "finding_ids": real}, {"text": "made up", "finding_ids": ["FND-NOPE-01"]},
                      {"text": "uncited", "finding_ids": []}], "actions": []}
    ans, dropped = validate_answer(ctx, raw)
    assert [c["text"] for c in ans["claims"]] == ["ok"] and ans["claims"][0]["sources"]
    assert ans["root_cause"] is None  # GG-03's chiller is not cited by any finding of this investigation
    assert {d["reason"] for d in dropped} == {"unknown finding id", "no finding_ids", "not cited by a kept finding"}


@pytest.fixture
def fresh_graph():
    name = "test_memory"
    b, _, _ = generate.build()
    generate.load(name, b)
    yield name
    get_graph(name).delete()


def test_memory_changes_next_investigation(fresh_graph):
    _, first = investigate(fresh_graph, "ALT-001", ScriptedBackend(), save_run=False)
    _, second = investigate(fresh_graph, "ALT-005", ScriptedBackend(), save_run=False)  # also dairy + chiller
    recalled = next(e["data"] for e in second.events if e["type"] == "memory_recalled")
    assert recalled["memories"][0]["past_alert_id"] == "ALT-001"
    assert rounds(first) == 2 and rounds(second) == 1
    plan = get_graph(fresh_graph).ro_query(
        "MATCH (p:Memory:Procedural) WHERE NOT ()-[:SUPERSEDES]->(p) RETURN p.plan, p.times_confirmed").result_set
    assert plan == [['["store_ops", "growth", "facilities"]', 2]]  # same plan confirmed; growth kept


# ---- Claude backend: message handling, against a fake client (no network) ----

class FakeMessages:
    def __init__(self, responses):
        self.responses, self.requests = list(responses), []

    def create(self, **kw):
        self.requests.append({**kw, "messages": [dict(m) for m in kw["messages"]]})
        return self.responses.pop(0)


def fake_client(responses):
    msgs = FakeMessages(responses)
    return SimpleNamespace(beta=SimpleNamespace(messages=msgs)), msgs


def block(**kw):
    return SimpleNamespace(**kw)


def test_claude_backend_runs_tool_loop(graph):
    tool_turn = SimpleNamespace(stop_reason="tool_use", stop_details=None, content=[
        block(type="text", text="Checking campaigns."),
        block(type="tool_use", id="toolu_1", name="find_amplifiers", input={"alert_id": "ALT-001"})])
    final = SimpleNamespace(stop_reason="end_turn", stop_details=None, content=[block(type="text", text="CMP-01 found.")])
    client, msgs = fake_client([tool_turn, final])
    inv = Investigation(graph, "ALT-001", "fake")
    inv.open()
    ctx = Ctx(graph, inv, ClaudeBackend(client=client), TOOLS["get_alert"](graph, alert_id="ALT-001")["result"],
              agent="growth", shared={"instructions": {}, "answer": None})
    report = run_agent(ctx, DEPARTMENTS["growth"], "Find amplifiers for ALT-001.")
    assert report == "CMP-01 found."
    req1, req2 = msgs.requests
    assert req1["model"] == "claude-opus-5-5" and req1["fallbacks"] == "default"
    assert all(t["strict"] and not t["input_schema"]["additionalProperties"] for t in req1["tools"])
    assert req2["messages"][1]["content"] is tool_turn.content  # assistant turn appended unchanged
    result = req2["messages"][2]["content"][0]
    assert result["type"] == "tool_result" and result["tool_use_id"] == "toolu_1" and "CMP-01" in result["content"]
    assert any(f["tool"] == "find_amplifiers" for f in inv.findings().values())


def test_claude_refusal_raises(graph):
    refused = SimpleNamespace(stop_reason="refusal", stop_details=SimpleNamespace(category=None), content=[])
    client, _ = fake_client([refused])
    inv = Investigation(graph, "ALT-001", "fake")
    ctx = Ctx(graph, inv, ClaudeBackend(client=client), {}, agent="growth", shared={"instructions": {}, "answer": None})
    with pytest.raises(AgentError):
        run_agent(ctx, DEPARTMENTS["growth"], "x")


def test_memory_from_other_cause_does_not_narrow_search(fresh_graph):
    """Regression: a campaign-caused dairy incident must not stop the next dairy alert finding its chiller."""
    from ingestor import ingest
    r = ingest(fresh_graph, "ALERT SD-02: promise time up from 9.1 to 15.4 min. Pick time on Probiotic Buttermilk "
                            "500ml is the main contributor.", "PER-015")
    first, _ = investigate(fresh_graph, r["alert_id"], ScriptedBackend(), save_run=False)
    assert first["root_cause"]["id"] == "CMP-01"
    answer, inv = investigate(fresh_graph, "ALT-001", ScriptedBackend(), save_run=False)
    assert answer["root_cause"]["id"] == "EQ-SD04-CHA1" and answer["amplifier"]["id"] == "CMP-01"


def test_bad_procedural_memory_is_harmless(fresh_graph):
    """Even a plan that names only growth cannot stop store_ops from running and finding the chiller."""
    g = get_graph(fresh_graph)
    investigate(fresh_graph, "ALT-005", ScriptedBackend(), save_run=False)
    g.query("MATCH (p:Memory:Procedural) SET p.plan = $plan", {"plan": '["growth"]'})
    answer, _ = investigate(fresh_graph, "ALT-001", ScriptedBackend(), save_run=False)
    assert answer["root_cause"]["id"] == "EQ-SD04-CHA1"


def test_model_failure_marks_investigation_failed(graph):
    class Broken:
        name = "broken"

        def step(self, *a):
            raise ConnectionError("network down")

    answer, inv = investigate(graph, "ALT-003", Broken(), save_run=False)
    assert answer["root_cause"] is None and any(e["type"] == "error" for e in inv.events)
    status = get_graph(graph).ro_query("MATCH (i:Investigation {id: $i}) RETURN i.status", {"i": inv.id}).result_set
    assert status == [["failed"]]
    assert not [e for e in inv.events if e["type"] == "memory_written"]


def test_claude_backend_without_credentials_fails_fast(monkeypatch):
    import llm
    monkeypatch.setattr(llm, "has_credentials", lambda: False)
    with pytest.raises(AgentError):
        ClaudeBackend()


def test_models_cite_short_refs(graph):
    """Models see F1, F2, ...; the validator maps refs to full Finding ids and rejects unknown refs."""
    _, inv = investigate(graph, "ALT-001", ScriptedBackend(), save_run=False)
    assert inv.refs and all(r.startswith("F") and inv.refs[r].startswith("FND-") for r in inv.refs)
    ctx = Ctx(graph, inv, ScriptedBackend(), {"store_id": "SD-04"})
    trace_ref = next(r for r, fid in inv.refs.items() if inv.findings()[fid]["tool"] == "trace_decision")
    ans, dropped = validate_answer(ctx, {"summary": "", "root_cause_id": "EQ-SD04-CHA1", "amplifier_id": None,
                                         "claims": [{"text": "a", "finding_ids": [trace_ref]},
                                                    {"text": "b", "finding_ids": ["F99"]}], "actions": []})
    assert ans["claims"][0]["finding_ids"] == [inv.refs[trace_ref]] and ans["root_cause"]["id"] == "EQ-SD04-CHA1"
    assert [d["text"] for d in dropped] == ["b"]

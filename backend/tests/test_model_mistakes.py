"""Regressions from real gpt-oss-20b runs on build.nvidia.com (2026-10-16). Each test replays one mistake."""
import json

from agents import DEPARTMENTS, ORCHESTRATOR, T_EQUIP, T_PATH, T_READ, Ctx, check_args, run_agent, validate_answer
from llm import LocalBackend, ScriptedBackend
from orchestrator import investigate
from state import Investigation
from test_local_backend import FakeOpenAI, Msg
from tools import TOOLS


def ctx_for(graph, alert_id, agent="store_ops", backend=None):
    inv = Investigation(graph, alert_id, "test")
    inv.open()
    return Ctx(graph, inv, backend or ScriptedBackend(), TOOLS["get_alert"](graph, alert_id=alert_id)["result"],
               agent=agent, shared={"instructions": {}, "answer": None, "order": [], "round_depts": {}})


def test_alert_id_confused_with_finding_ref_is_ignored(graph):
    """The orchestrator wrote 'Investigate alert F1' and Store Ops called trace_decision(alert_id='F1')."""
    fake = FakeOpenAI([Msg(calls=[("c1", "trace_decision", '{"alert_id": "F1"}')]), Msg("done")])
    ctx = ctx_for(graph, "ALT-001", backend=LocalBackend(base_url="http://x/v1", client=fake))
    run_agent(ctx, DEPARTMENTS["store_ops"], "Investigate alert F1.")
    trace = next(f for f in ctx.inv.findings().values() if f["tool"] == "trace_decision")
    assert trace["data"]["decision"]["id"] == "DEC-209"  # the investigation's alert is bound, not the model's guess


def test_bad_enum_values_and_refs_as_ids_are_rejected():
    assert "must be one of" in check_args(T_READ, {"agent": "store ops"})[1]
    assert "must be one of" in check_args(T_EQUIP, {"store_id": "SD-04", "kind": "sync"})[1]
    assert "Finding ref" in check_args(T_PATH, {"from_id": "F1", "to_id": "F3"})[1]
    assert check_args(T_EQUIP, {"store_id": "SD-04"}) == ({"store_id": "SD-04", "kind": None}, None)
    assert check_args(T_EQUIP, {"kind": "rack"})[1] == "missing argument 'store_id'"


def test_ticket_root_cause_maps_to_its_equipment_and_decision_is_not_an_amplifier(graph):
    """ALT-005: the model named ticket FAC-903 as root cause and decision DEC-303 as amplifier."""
    _, inv = investigate(graph, "ALT-005", ScriptedBackend(), save_run=False)
    ctx = Ctx(graph, inv, ScriptedBackend(), TOOLS["get_alert"](graph, alert_id="ALT-005")["result"])
    trace_ref = next(r for r, fid in inv.refs.items() if inv.findings()[fid]["tool"] == "trace_decision")
    ans, dropped = validate_answer(ctx, {"summary": "", "root_cause_id": "FAC-903", "amplifier_id": "DEC-303",
                                         "claims": [{"text": "x", "finding_ids": [trace_ref]}], "actions": []})
    assert ans["root_cause"]["id"] == "EQ-ED06-CHA1" and ans["amplifier"] is None
    assert any("must be a Campaign" in d["reason"] for d in dropped)


def test_search_only_root_cause_rejected_and_not_remembered(graph):
    """ALT-001: keyword search surfaced ENG-404 and the model blamed it; that answer was then written to memory."""
    ctx = ctx_for(graph, "ALT-001")
    from agents import T_SEARCH
    out = T_SEARCH.handler(ctx, text="stock sync delay inventory")
    ref = out["finding"]
    ticket = next(h["id"] for h in out["result"]["hits"] if h["label"] == "Ticket")  # a hit the search did return
    ans, dropped = validate_answer(ctx, {"summary": "", "root_cause_id": ticket, "amplifier_id": None,
                                         "claims": [{"text": "That ticket caused it.", "finding_ids": [ref]}],
                                         "actions": []})
    assert ans["root_cause"] is None
    assert any("keyword-search" in d["reason"] or "root cause must be one of" in d["reason"] for d in dropped)
    assert ctx.inv.remember(ctx.alert, ans, ["store_ops"]) == []  # no root cause, nothing remembered


def test_orchestrator_prompt_separates_refs_from_ids(graph):
    _, inv = investigate(graph, "ALT-001", ScriptedBackend(), save_run=False)
    # the task text the orchestrator receives says refs are only for citing
    fake = FakeOpenAI([Msg(calls=[("s1", "submit_answer", json.dumps(
        {"summary": "", "root_cause_id": None, "amplifier_id": None, "claims": [], "actions": []}))])])
    investigate(graph, "ALT-001", LocalBackend(base_url="http://x/v1", client=fake), save_run=False)
    task = fake.requests[0]["messages"][1]["content"]
    assert "only for citing" in task and "ALT-001" in task


def test_typographic_hyphens_in_ids_are_normalized(graph):
    """ALT-007 run 2026-10-17: root_cause_id 'EQ‑NO05‑RACK3' (non-breaking hyphens) was dropped as
    'no such node', so the correct answer wrote no memory."""
    _, inv = investigate(graph, "ALT-007", ScriptedBackend(), save_run=False)
    ctx = Ctx(graph, inv, ScriptedBackend(), TOOLS["get_alert"](graph, alert_id="ALT-007")["result"])
    trace_ref = next(r for r, fid in inv.refs.items() if inv.findings()[fid]["tool"] == "trace_decision")
    ans, dropped = validate_answer(ctx, {"summary": "", "root_cause_id": "EQ‑NO05‑RACK3", "amplifier_id": None,
                                         "claims": [{"text": "x", "finding_ids": [trace_ref]}], "actions": []})
    assert ans["root_cause"]["id"] == "EQ-NO05-RACK3" and not dropped
    assert check_args(T_EQUIP, {"store_id": "NO–05​", "kind": "rack"}) == (
        {"store_id": "NO-05", "kind": "rack"}, None)

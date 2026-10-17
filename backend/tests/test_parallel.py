"""Parallel dispatch: departments in one round run at the same time, write to the shared state safely, and one
failure or bad item does not sink the investigation."""
import threading
import time

from agents import Ctx, _dispatch
from db import get_graph
from llm import ScriptedBackend
from orchestrator import investigate
from tools import TOOLS


class Timed(ScriptedBackend):
    """Scripted choices, but each department step takes 0.3s, with start/end times recorded per department."""

    def __init__(self, fail=None, report_suffix=None):
        super().__init__()
        self.spans, self.fail, self.suffix, self.lock = {}, fail, report_suffix, threading.Lock()

    def step(self, agent, system, tools, messages, history, ctx):
        if agent != "orchestrator":
            if agent == self.fail:
                raise ConnectionError("model server dropped the connection")
            t0 = time.monotonic()
            time.sleep(0.3)
            with self.lock:
                s = self.spans.setdefault(agent, [t0, t0])
                s[1] = time.monotonic()
        turn = super().step(agent, system, tools, messages, history, ctx)
        if self.suffix and agent == "store_ops" and not turn.calls:
            turn.text += self.suffix
        return turn


def test_round_one_departments_overlap(graph):
    b = Timed()
    answer, inv = investigate(graph, "ALT-001", b, save_run=False)
    (s0, s1), (g0, g1) = b.spans["store_ops"], b.spans["growth"]
    assert s0 < g1 and g0 < s1  # store_ops and growth ran at the same time
    assert answer["root_cause"]["id"] == "EQ-SD04-CHA1" and answer["amplifier"]["id"] == "CMP-01"
    rounds = [e["data"]["round"] for e in inv.events if e["type"] == "task_created"]
    assert rounds.count(1) >= 2 and max(rounds) <= 2  # one parallel round, plus at most one follow-up
    ids = [e["data"]["finding_id"] for e in inv.events if e["type"] == "finding_written"]
    assert len(ids) == len(set(ids))  # concurrent writers never collide on a Finding id


def test_one_department_failing_does_not_sink_the_rest(graph):
    answer, inv = investigate(graph, "ALT-001", Timed(fail="growth"), save_run=False)
    assert answer["root_cause"]["id"] == "EQ-SD04-CHA1" and answer["amplifier"] is None
    done = {e["data"]["department"]: e["data"]["status"] for e in inv.events if e["type"] == "task_completed"}
    assert done["growth"] == "failed" and done["store_ops"] == "done"
    status = get_graph(graph).ro_query("MATCH (t:Task {department: 'growth'})-[:PART_OF]->(:Investigation {id: $i}) "
                                       "RETURN t.status", {"i": inv.id}).result_set
    assert status == [["failed"]]


def test_bad_items_rejected_individually(graph):
    _, inv = investigate(graph, "ALT-003", ScriptedBackend(), save_run=False)
    ctx = Ctx(graph, inv, ScriptedBackend(), TOOLS["get_alert"](graph, alert_id="ALT-003")["result"],
              shared={"round": 9, "order": [], "instructions": {}, "answer": None, "round_depts": {}})
    out = _dispatch(ctx, [{"department": "growth", "instruction": "Check campaigns."},
                          {"department": "growth", "instruction": "Again."},
                          {"department": "legal", "instruction": "x"},
                          {"department": "supply", "instruction": "  "}])
    by = [(r["department"], r.get("error", "ok")) for r in out["results"]]
    assert by[0] == ("growth", "ok")
    assert any("already dispatched" in e for d, e in by if d == "growth")
    assert any(d == "legal" and "unknown department" in e for d, e in by)
    assert any(d == "supply" and "empty instruction" in e for d, e in by)


def test_report_refs_not_backed_by_own_findings_are_flagged(graph):
    _, inv = investigate(graph, "ALT-002", Timed(report_suffix=" Also see F99 and F1."), save_run=False)
    done = next(e["data"] for e in inv.events if e["type"] == "task_completed" and e["data"]["department"] == "store_ops")
    # F1 is the orchestrator's alert Finding and F99 does not exist: neither is a store_ops Finding
    assert done["unverified_refs"] == ["F1", "F99"]

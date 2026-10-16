"""Investigator: starts from an Alert, calls graph tools, and composes a cited answer.

Phase 1 uses a fixed tool plan (no LLM). Phase 2 replaces `plan_and_call` with the LLM tool loop;
the event stream (docs/events.md) and the answer shape (docs/tool_contract.md) stay the same.
Every claim cites the step ids that support it; until Finding nodes exist (Phase 2) a step id
stands in for a Finding id.
"""
from datetime import datetime, timezone

from tools import TOOLS


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class Run:
    def __init__(self, graph, alert_id, emit=None):
        self.graph, self.alert_id = graph, alert_id
        self.id = f"INV-{alert_id}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        self.events, self.steps = [], []
        self._emit = emit

    def emit(self, type_, **data):
        ev = {"type": type_, "ts": now(), "investigation_id": self.id, "data": data}
        self.events.append(ev)
        if self._emit:
            self._emit(ev)

    def call(self, name, **args):
        step = f"S{len(self.steps) + 1}"
        self.emit("tool_call", step=step, tool=name, args=args)
        r = TOOLS[name](self.graph, **args)
        r["step"] = step
        self.steps.append(r)
        if r["touched"]["nodes"]:
            self.emit("nodes_touched", step=step, node_ids=r["touched"]["nodes"])
        if r["touched"]["edges"]:
            self.emit("edges_touched", step=step, edges=r["touched"]["edges"])
        return r


def validate_answer(answer):
    """Drop any claim or action that cites no step/finding. Returns (answer, dropped)."""
    dropped = []
    for key in ("claims", "actions"):
        kept = []
        for c in answer[key]:
            (kept if c.get("finding_ids") else dropped).append(c)
        answer[key] = kept
    return answer, dropped


def investigate(graph, alert_id, emit=None):
    run = Run(graph, alert_id, emit)
    run.emit("investigation_started", alert_id=alert_id, tenant=graph, graph_enabled=True)

    ctx = run.call("get_alert", alert_id=alert_id)
    if ctx["error"]:
        answer = {"summary": f"Could not start: {ctx['error']}", "root_cause": None, "amplifier": None,
                  "claims": [], "actions": []}
        run.emit("answer_ready", answer=answer, dropped=[])
        return answer, run
    a = ctx["result"]
    run.call("search_artifacts", text=f"{a['sku_name']} {a['store_id']}")
    trace = run.call("trace_decision", alert_id=alert_id)
    amps = run.call("find_amplifiers", alert_id=alert_id)
    t, campaigns = trace["result"] or {}, (amps["result"] or {}).get("campaigns", [])
    equipment = [c for c in t.get("causes", []) if c["label"] == "Equipment"]
    experts = run.call("find_expert", entity_id=equipment[0]["id"]) if equipment else None

    claims, actions = [], []
    S = lambda r: [r["step"]]  # noqa: E731
    claims.append({"text": f"{a['store_id']} promise time rose from {a['before']} to {a['after']} min; "
                           f"the alert attributes it to {a['sku_name']}.", "finding_ids": S(ctx)})
    root, amplifier = None, None
    if t.get("decision"):
        d, au = t["decision"], t["author"]
        claims.append({"text": f"{au['name']} ({au['role']}) moved {a['sku_name']} from {d['moved_from']} to "
                               f"{d['moved_to']} at {d['decided_at']} ({d['id']}).",
                       "finding_ids": S(trace), "sources": d["evidence"]})
        for c in t["causes"]:
            if c["label"] == "Ticket":
                state = "unassigned" if c["unassigned"] else f"assigned to {c['owner']['name']}"
                claims.append({"text": f"The move was made because of ticket {c['id']} ({c['name']}), "
                                       f"status {c['status']}, {state}.",
                               "finding_ids": S(trace), "sources": c["evidence"]})
        if equipment:
            root = {"id": equipment[0]["id"], "name": f"{equipment[0]['name']} at {a['store_id']}"}
    for cm in campaigns:
        claims.append({"text": f"Campaign {cm['name']} ({cm['id']}), owned by {cm['owner']['name']}, went live "
                               f"{cm['hours_before_alert']}h before the alert and promotes {a['sku_name']} in "
                               f"{a['store_id']}.", "finding_ids": S(amps), "sources": cm["evidence"]})
    if campaigns:
        amplifier = {"id": campaigns[0]["id"], "name": campaigns[0]["name"]}
        if root is None:
            root, amplifier = amplifier, None  # demand spike with no physical cause

    if amplifier and root:
        cm = campaigns[0]
        actions.append({"text": f"Pause {cm['name']} for {a['store_id']}; tell {cm['owner']['name']} "
                                f"({cm['owner']['role']}).", "finding_ids": S(amps) + S(trace)})
    elif campaigns:
        cm = campaigns[0]
        actions.append({"text": f"Ask {cm['owner']['name']} to cap {cm['name']} in {a['store_id']} or raise "
                                f"replenishment for {a['sku_name']}.", "finding_ids": S(amps)})
    for c in t.get("causes", []):
        if c["label"] == "Ticket" and c["unassigned"] and equipment and equipment[0]["owner"]:
            owner = equipment[0]["owner"]
            top = next((p for p in experts["result"]["people"] if not p["is_owner"]), None) if experts else None
            hint = f"; {top['name']} has the most history with this unit" if top else ""
            actions.append({"text": f"Assign {c['id']} to {owner['name']} ({owner['role']}), who owns "
                                    f"{equipment[0]['name']}{hint}.",
                            "finding_ids": S(trace) + (S(experts) if experts else [])})

    if root and amplifier:
        summary = (f"Root cause: {root['name']} is down, so {a['sku_name']} was moved far from packing. "
                   f"Amplifier: {amplifier['name']} pushed demand for it.")
    elif root:
        summary = f"Root cause: {root['name']}."
    else:
        summary = "Inconclusive: no decision or campaign in the graph explains this alert."
    answer = {"summary": summary, "root_cause": root, "amplifier": amplifier, "claims": claims, "actions": actions}
    answer, dropped = validate_answer(answer)
    run.emit("answer_ready", answer=answer, dropped=dropped)
    return answer, run

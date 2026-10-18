"""Shared state: the only module that writes agent state (Investigation, Task, Finding, Memory) to the graph.

Agents never share Python objects with each other; they share these nodes. A Finding is written by code from
one tool result, so the model can cite Findings but never author their content.
"""
import json
import threading
import uuid
from datetime import datetime, timezone

from db import get_graph
from tools import cypher, run


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def write(graph, name, **params):
    return get_graph(graph).query(cypher(name), params).result_set


METRICS = {"promise_time_min": "promise time", "pick_time_sec": "pick time"}
UNITS = {"promise_time_min": "min", "pick_time_sec": "s"}
REL_WORDS = {"TARGETS": "targets", "HAS_EQUIPMENT": "has", "PROMOTES": "promotes", "STOCKS": "stocks",
             "SUPPLIES": "supplies", "OWNS": "owns", "WORKED_ON": "worked on", "ABOUT": "is about",
             "CHANGED": "changed", "MADE_BY": "was made by", "BECAUSE_OF": "was caused by", "AT": "is at",
             "INVOLVES": "involves", "EVIDENCE_FOR": "is evidence for", "AUTHORED_BY": "was written by"}


def when(ts):
    """2026-10-16T08:30:00Z -> 16 Oct 08:30 UTC"""
    try:
        return datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").strftime("%d %b %H:%M UTC").lstrip("0")
    except (TypeError, ValueError):
        return ts or "an unknown time"


def _cause(c):
    if c["label"] == "Ticket":
        state = "open, no one assigned" if c["unassigned"] else (
            f"{c['status']}, assigned to {c['owner']['name']}" if c["owner"] else c["status"] or "status unknown")
        return f"ticket {c['id']} \u201c{c['name']}\u201d ({state})"
    owner = f", owned by {c['owner']['name']}" if c["owner"] else ""
    return f"{c['name']} ({c['id']}{owner})"


def summarize(r):
    """One plain-English sentence or two per tool result: the Finding's summary. Names first, ids in parentheses,
    readable times. Written for a person reading the investigation; models read it too, ids included."""
    t, res = r["tool"], r["result"] or {}
    if r["error"]:
        return f"This step failed: {r['error']}"
    if t == "get_alert":
        metric = METRICS.get(res["metric"], res["metric"])
        unit = UNITS.get(res["metric"], "")
        return (f"Alert {res['alert_id']}: {metric} at {res['store_name']} rose from {res['before']} to "
                f"{res['after']} {unit} at {when(res['ts'])}. The alert points to {res['sku_name']} ({res['sku_id']}).")
    if t == "trace_decision":
        if not res.get("decision"):
            return "No decision changed how this item is handled at this store before the alert."
        d, a = res["decision"], res["author"]
        causes = "; ".join(_cause(c) for c in res["causes"]) or "none recorded"
        return (f"{a['name']} ({a['role']}) moved the item from {d['moved_from']} to {d['moved_to']} on "
                f"{when(d['decided_at'])} (decision {d['id']}). Recorded causes: {causes}.")
    if t == "find_amplifiers":
        cs = res.get("campaigns", [])
        if not cs:
            return "No active campaign was promoting this item at this store when the alert fired."
        return " ".join(f"Campaign {c['name']} ({c['id']}), owned by {c['owner']['name']}, is active: it started "
                        f"{c['hours_before_alert']} hours before the alert and promotes this item at this store."
                        for c in cs)
    if t == "find_expert":
        ps = ", ".join(f"{p['name']} ({p['touches']} job{'s' if p['touches'] != 1 else ''}"
                       f"{', owner' if p['is_owner'] else ''})" for p in res["people"])
        return f"People who have worked on {res['entity_id']}: {ps or 'nobody on record'}."
    if t == "equipment_status":
        bad = [u for u in res["equipment"] if u["open_unassigned"]]
        if not bad:
            return f"No equipment checked at {res['store_id']} has an open ticket waiting for someone to take it."
        return " ".join(f"At {res['store_id']}, {u['name']} ({u['id']}"
                        + (f", owned by {u['owner']['name']}" if u["owner"] else "")
                        + f") has open ticket{'s' if len(u['open_unassigned']) > 1 else ''} with no one assigned: "
                        + f"{', '.join(u['open_unassigned'])}." for u in bad)
    if t == "impact_of":
        sp = res["supplier"]
        cs = ", ".join(f"{c['name']} ({c['id']}, owned by {c['owner']['name']})" for c in res["active_campaigns"])
        return (f"If {sp['name']} ({sp['id']}) is late, {len(res['stores'])} stores are affected. Hero items at risk: "
                f"{', '.join(res['hero_skus']) or 'none'}. Campaigns running on its items: {cs or 'none'}. "
                f"Supply planner to tell: {sp['planner']['name']}.")
    if t == "search_artifacts":
        hits = res["hits"]
        return (f"Keyword search for \u201c{' '.join(res['query_terms'])}\u201d found {len(hits)} match"
                f"{'es' if len(hits) != 1 else ''} ({', '.join(h['id'] for h in hits) or 'none'}). Matches are leads, "
                f"not evidence.")
    if t == "connect_path":
        if not res["linked"]:
            return f"{res['from']} and {res['to']} are not connected within a few steps in the graph."
        steps = ", then ".join(f"{e['from']} {REL_WORDS.get(e['type'], e['type'].lower())} {e['to']}"
                               for e in res["edges"])
        return (f"{res['path'][0]['id']} and {res['path'][-1]['id']} are connected in {res['hops']} step"
                f"{'s' if res['hops'] != 1 else ''}: {steps}.")
    if t == "rank_people":
        return "Most connected to this incident: " + (", ".join(
            f"{p['name']} ({p['role']}, {p['links']} link{'s' if p['links'] != 1 else ''})" for p in res["people"])
            or "nobody") + "."
    return f"{t} returned a result."


class Investigation:
    """Handle on one investigation's shared state. Thread-safe: department agents run in parallel."""

    def __init__(self, graph, alert_id, model, emit=None):
        self.graph, self.alert_id, self.model = graph, alert_id, model
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        self.id = f"INV-{alert_id}-{stamp}-{uuid.uuid4().hex[:4]}"
        self._short = self.id.split("-", 1)[1]
        self._lock = threading.Lock()
        self._n = {"T": 0, "F": 0, "S": 0}
        self._emit = emit
        self.events = []
        self.refs, self.ref_of = {}, {}  # short Finding refs ("F3") shown to models <-> full Finding ids

    def next_id(self, kind):
        with self._lock:
            self._n[kind] += 1
            n = self._n[kind]
        return {"T": f"TSK-{self._short}-{n:02d}", "F": f"FND-{self._short}-{n:02d}", "S": f"S{n}"}[kind]

    def emit(self, type_, **data):
        ev = {"type": type_, "ts": now(), "investigation_id": self.id, "data": data}
        with self._lock:
            self.events.append(ev)
        if self._emit:
            self._emit(ev)

    def open(self):
        write(self.graph, "w_create_investigation", id=self.id, alert_id=self.alert_id, model=self.model, ts=now())

    def task(self, department, instruction, round_):
        tid = self.next_id("T")
        write(self.graph, "w_create_task", id=tid, investigation_id=self.id, department=department,
              instruction=instruction, round=round_)
        self.emit("task_created", task_id=tid, department=department, instruction=instruction, round=round_)
        return tid

    def complete_task(self, task_id, department, report, finding_ids, status="done", unverified_refs=()):
        write(self.graph, "w_complete_task", id=task_id, report=report, status=status)
        self.emit("task_completed", task_id=task_id, department=department, report=report, finding_ids=finding_ids,
                  status=status, unverified_refs=list(unverified_refs))

    def resolve(self, ref_or_id):
        """Full Finding id for a short ref (or an id passed through unchanged)."""
        return self.refs.get(ref_or_id, ref_or_id)

    def finding(self, agent, task_id, r):
        """Write one Finding from one tool result; it CITES every node the tool touched.
        Returns the short ref models use to cite it, and its summary."""
        fid = self.next_id("F")
        ref = f"F{int(fid.rsplit('-', 1)[1])}"
        with self._lock:
            self.refs[ref], self.ref_of[fid] = fid, ref
        summary = summarize(r)
        write(self.graph, "w_write_finding", id=fid, investigation_id=self.id, agent=agent, tool=r["tool"],
              task_id=task_id, summary=summary, data=json.dumps(r["result"], sort_keys=True), ts=now(),
              cites=r["touched"]["nodes"])
        self.emit("finding_written", finding_id=fid, ref=ref, agent=agent, task_id=task_id, tool=r["tool"],
                  summary=summary, cites=r["touched"]["nodes"], sources=r["sources"])
        return ref, summary

    def findings(self):
        """All Findings of this investigation, read back from the graph (never from agent memory)."""
        rows = run(self.graph, "read_findings", investigation_id=self.id, agent=None)
        return {r["finding_id"]: {**r, "data": json.loads(r["data"]) if r["data"] else None} for r in rows}

    def finish(self, status, answer):
        write(self.graph, "w_finish_investigation", id=self.id, status=status, ts=now(),
              answer=json.dumps(answer, sort_keys=True))

    def remember(self, alert, answer, plan):
        """Write episodic and procedural memory from a validated answer. Returns memory ids written."""
        root = answer.get("root_cause")
        if not root:
            return []
        kind = root.get("kind") or root.get("label", "unknown").lower()
        amp = answer.get("amplifier")
        metric = METRICS.get(alert["metric"], alert["metric"])
        content = (f"{when(alert['ts'])}: {metric} rose at {alert['store_id']} on {alert['sku_name']}. Root cause: "
                   f"{root['name']} ({kind})" + (f", amplified by {amp['name']}" if amp else "") + ".")
        about = [alert["store_id"], alert["sku_id"], root["id"]] + ([amp["id"]] if amp else [])
        mid = f"MEM-E-{self._short}"
        write(self.graph, "w_write_episodic", id=mid, investigation_id=self.id, content=content, ts=now(),
              alert_id=alert["alert_id"], metric=alert["metric"], sku_category=alert["sku_category"],
              root_cause_kind=kind, root_cause_id=root["id"], about=about)
        self.emit("memory_written", memory_id=mid, kind="episodic", content=content, investigation_id=self.id)
        key = f"{alert['metric']}|{alert['sku_category']}|{kind}"
        # A learned plan only grows: departments that came up empty this time are still worth checking next time.
        prev = run(self.graph, "procedural_by_key", key=key)
        if prev:
            old = json.loads(prev[0]["plan"])
            plan = old + [d for d in plan if d not in old]
        dept = {"store_ops": "Store Ops", "facilities": "Facilities", "growth": "Growth", "supply": "Supply"}
        pcontent = (f"For {METRICS.get(alert['metric'], alert['metric'])} alerts on {alert['sku_category']} items "
                    f"caused by a {kind}: send {', '.join(dept.get(d, d) for d in plan)} together in round 1" + (f"; Facilities should check {kind} units at the "
                                                               f"alert's store first" if 'facilities' in plan else "") + ".")
        rows = write(self.graph, "w_write_procedural", id=f"MEM-P-{self._short}", investigation_id=self.id, key=key,
                     plan=json.dumps(plan), content=pcontent, ts=now())
        pid, created = rows[0]
        self.emit("memory_written", memory_id=pid, kind="procedural", content=pcontent, investigation_id=self.id,
                  created=bool(created))
        return [mid, pid]

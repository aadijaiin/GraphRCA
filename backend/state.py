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


def summarize(r):
    """One line of plain fact per tool result. This is the Finding's summary."""
    t, res = r["tool"], r["result"] or {}
    if r["error"]:
        return f"{t} failed: {r['error']}"
    if t == "get_alert":
        return (f"Alert {res['alert_id']} at {res['store_id']}: {res['metric']} {res['before']} -> {res['after']} "
                f"at {res['ts']}, attributed to {res['sku_name']} ({res['sku_id']}).")
    if t == "trace_decision":
        if not res.get("decision"):
            return "No decision moved this SKU at this store before the alert."
        d, a = res["decision"], res["author"]
        causes = "; ".join(
            f"{c['id']} ({c['label']}" + (f", {c['status']}" if c["status"] else "")
            + (", unassigned" if c["unassigned"] else (f", owner {c['owner']['name']}" if c["owner"] else "")) + ")"
            for c in res["causes"]) or "none recorded"
        return (f"{d['id']} by {a['name']} ({a['role']}) at {d['decided_at']}: moved from {d['moved_from']} to "
                f"{d['moved_to']}. Causes: {causes}.")
    if t == "find_amplifiers":
        cs = res.get("campaigns", [])
        if not cs:
            return "No active campaign promotes this SKU in this store."
        return " ".join(f"{c['id']} {c['name']} (owner {c['owner']['name']}) is active, started "
                        f"{c['hours_before_alert']}h before the alert, promotes the SKU in this store." for c in cs)
    if t == "find_expert":
        ps = ", ".join(f"{p['name']} ({p['touches']} touches{', owner' if p['is_owner'] else ''})" for p in res["people"])
        return f"People with history on {res['entity_id']}: {ps or 'none'}."
    if t == "equipment_status":
        bad = [u for u in res["equipment"] if u["open_unassigned"]]
        if not bad:
            return f"No open unassigned tickets on the checked equipment at {res['store_id']}."
        return " ".join(f"{u['name']} ({u['id']}, owner {u['owner']['name'] if u['owner'] else 'none'}) has open "
                        f"unassigned ticket(s) {', '.join(u['open_unassigned'])}." for u in bad)
    if t == "impact_of":
        s = res["supplier"]
        cs = ", ".join(f"{c['name']} (owner {c['owner']['name']})" for c in res["active_campaigns"]) or "none"
        return (f"{s['name']} feeds {len(res['stores'])} stores; hero SKUs at risk: {', '.join(res['hero_skus'])}; "
                f"active campaigns on its SKUs: {cs}. Planner: {s['planner']['name']}.")
    if t == "search_artifacts":
        return f"Search {' '.join(res['query_terms'])}: {len(res['hits'])} hits ({', '.join(h['id'] for h in res['hits'])})."
    if t == "connect_path":
        if not res["linked"]:
            return f"No path within range between {res['from']} and {res['to']}."
        return f"{res['path'][0]['id']} links to {res['path'][-1]['id']} in {res['hops']} hops: " + " -> ".join(
            f"{e['from']} {e['type']} {e['to']}" for e in res["edges"]) + "."
    if t == "rank_people":
        return "Most connected to this incident: " + ", ".join(
            f"{p['name']} ({p['links']} links)" for p in res["people"]) + "."
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

    def complete_task(self, task_id, department, report, finding_ids):
        write(self.graph, "w_complete_task", id=task_id, report=report)
        self.emit("task_completed", task_id=task_id, department=department, report=report, finding_ids=finding_ids)

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
        content = (f"{alert['ts'][:10]} {alert['metric']} at {alert['store_id']} on {alert['sku_name']}: root cause "
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
        pcontent = (f"For {alert['metric']} alerts on {alert['sku_category']} SKUs caused by a {kind}: dispatch "
                    f"{', '.join(plan)} together in round 1" + (f"; Facilities should check {kind} units at the "
                                                               f"alert's store first" if 'facilities' in plan else "") + ".")
        rows = write(self.graph, "w_write_procedural", id=f"MEM-P-{self._short}", investigation_id=self.id, key=key,
                     plan=json.dumps(plan), content=pcontent, ts=now())
        pid, created = rows[0]
        self.emit("memory_written", memory_id=pid, kind="procedural", content=pcontent, investigation_id=self.id,
                  created=bool(created))
        return [mid, pid]

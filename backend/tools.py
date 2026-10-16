"""Agent tools. Each wraps parameterized queries from queries/ and returns the tool result contract
in docs/tool_contract.md: {tool, args, result, touched: {nodes, edges}, sources, error}.

The agent never writes Cypher; it can only call these functions.
"""
import json
import re
from datetime import datetime
from functools import lru_cache, wraps
from pathlib import Path

from db import get_graph

QUERIES = Path(__file__).resolve().parent.parent / "queries"
TOOLS = {}

STOPWORDS = {"the", "and", "for", "with", "from", "that", "this", "was", "are", "has", "have", "why", "what",
             "who", "did", "does", "not", "but", "its", "our", "into", "over", "about"}


@lru_cache
def cypher(name):
    text = (QUERIES / f"{name}.cypher").read_text()
    return "\n".join(l for l in text.splitlines() if not l.strip().startswith("//"))


def run(graph, name, **params):
    """Run a named query read-only and return rows as dicts."""
    res = get_graph(graph).ro_query(cypher(name), params)
    cols = [h[1] for h in res.header]
    return [dict(zip(cols, row)) for row in res.result_set]


def _hours(a, b):
    f = "%Y-%m-%dT%H:%M:%SZ"
    return round((datetime.strptime(b, f) - datetime.strptime(a, f)).total_seconds() / 3600, 1)


def edge(rel, src, dst):
    return {"type": rel, "from": src, "to": dst}


def _dedupe(items):
    seen, out = set(), []
    for it in items:
        key = tuple(sorted(it.items())) if isinstance(it, dict) else it
        if it is not None and key not in seen:
            seen.add(key)
            out.append(it)
    return out


def tool(fn):
    """Wrap a tool body (returning result, nodes, edges, sources) in the result contract."""
    @wraps(fn)
    def wrapper(graph, **args):
        out = {"tool": fn.__name__, "args": args, "result": None,
               "touched": {"nodes": [], "edges": []}, "sources": [], "error": None}
        try:
            result, nodes, edges, sources = fn(graph, **args)
            out.update(result=result, touched={"nodes": _dedupe(nodes), "edges": _dedupe(edges)},
                       sources=_dedupe(sources))
        except Exception as e:  # tool errors go back to the agent, never crash the loop
            out["error"] = f"{type(e).__name__}: {e}"
        return out
    TOOLS[fn.__name__] = wrapper
    return wrapper


@tool
def get_alert(graph, alert_id):
    """The alert, the store it fired at, and the SKU it involves."""
    rows = run(graph, "alert_context", alert_id=alert_id)
    if not rows:
        raise LookupError(f"no alert {alert_id}")
    r = rows[0]
    return (r, [r["alert_id"], r["store_id"], r["sku_id"]],
            [edge("AT", r["alert_id"], r["store_id"]), edge("INVOLVES", r["alert_id"], r["sku_id"])], [])


@tool
def search_artifacts(graph, text, limit=8):
    """Full-text anchor search over messages/SOPs/ticket text, ticket titles and SKU names."""
    terms = [t for t in re.findall(r"[A-Za-z0-9]+", text.lower()) if len(t) >= 3 and t not in STOPWORDS]
    if not terms:
        raise ValueError("no searchable terms")
    terms = list(dict.fromkeys(terms))
    # Hits matching every term rank first; any-term hits fill the rest of the limit.
    rows, seen = [], set()
    for q in (" ".join(terms), "|".join(terms)):
        for r in sorted(run(graph, "search_artifacts", q=q), key=lambda r: (-r["score"], r["id"])):
            if r["id"] not in seen and len(rows) < limit:
                seen.add(r["id"])
                rows.append(r)
    hits = [{"id": r["id"], "label": r["label"], "text": r["text"], "kind": r["kind"], "ts": r["ts"],
             "score": round(r["score"], 2)} for r in rows]
    return ({"query_terms": terms, "hits": hits}, [h["id"] for h in hits], [],
            [h["id"] for h in hits if h["label"] == "Artifact"])


@tool
def trace_decision(graph, alert_id):
    """Latest decision that moved the alert's SKU in the alert's store, with author, causes and evidence."""
    rows = run(graph, "trace_decision", alert_id=alert_id)
    if not rows:
        return {"decision": None}, [], [], []
    r0 = rows[0]
    d = r0["decision_id"]
    causes = []
    for r in rows:
        if r["cause_id"] is None:
            continue
        owner = ({"id": r["cause_owner_id"], "name": r["cause_owner_name"], "role": r["cause_owner_role"]}
                 if r["cause_owner_id"] else None)
        causes.append({"id": r["cause_id"], "label": r["cause_label"], "name": r["cause_name"],
                       "status": r["cause_status"], "owner": owner,
                       "unassigned": r["cause_label"] == "Ticket" and owner is None,
                       "evidence": r["cause_evidence"]})
    result = {
        "decision": {"id": d, "summary": r0["summary"], "decided_at": r0["decided_at"],
                     "moved_from": r0["moved_from"], "moved_to": r0["moved_to"], "evidence": r0["evidence"]},
        "author": {"id": r0["author_id"], "name": r0["author_name"], "role": r0["author_role"]},
        "causes": causes,
    }
    nodes = [alert_id, r0["sku_id"], r0["store_id"], d, r0["author_id"], *r0["evidence"]]
    edges = [edge("INVOLVES", alert_id, r0["sku_id"]), edge("AT", alert_id, r0["store_id"]),
             edge("CHANGED", d, r0["sku_id"]), edge("AT", d, r0["store_id"]), edge("MADE_BY", d, r0["author_id"]),
             *[edge("EVIDENCE_FOR", ev, d) for ev in r0["evidence"]]]
    sources = list(r0["evidence"])
    for c in causes:
        nodes += [c["id"], *c["evidence"]]
        edges += [edge("BECAUSE_OF", d, c["id"]), *[edge("EVIDENCE_FOR", ev, c["id"]) for ev in c["evidence"]]]
        sources += c["evidence"]
        if c["owner"]:
            nodes.append(c["owner"]["id"])
            edges.append(edge("OWNS", c["owner"]["id"], c["id"]))
    return result, nodes, edges, sources


@tool
def find_amplifiers(graph, alert_id):
    """Active campaigns promoting the alert's SKU in the alert's store, started before the alert."""
    rows = run(graph, "find_amplifiers", alert_id=alert_id)
    campaigns, nodes, edges, sources = [], [alert_id], [], []
    for r in rows:
        campaigns.append({"id": r["campaign_id"], "name": r["campaign_name"], "started_at": r["started_at"],
                          "hours_before_alert": _hours(r["started_at"], r["alert_ts"]),
                          "owner": {"id": r["owner_id"], "name": r["owner_name"], "role": r["owner_role"]},
                          "evidence": r["evidence"]})
        nodes += [r["store_id"], r["sku_id"], r["campaign_id"], r["owner_id"], *r["evidence"]]
        edges += [edge("AT", alert_id, r["store_id"]), edge("INVOLVES", alert_id, r["sku_id"]),
                  edge("PROMOTES", r["campaign_id"], r["sku_id"]), edge("TARGETS", r["campaign_id"], r["store_id"]),
                  edge("OWNS", r["owner_id"], r["campaign_id"]),
                  *[edge("EVIDENCE_FOR", ev, r["campaign_id"]) for ev in r["evidence"]]]
        sources += r["evidence"]
    return {"campaigns": campaigns}, nodes, edges, sources


@tool
def find_expert(graph, entity_id):
    """People ranked by how often they worked on the entity (directly or via tickets about it)."""
    rows = run(graph, "find_expert", entity_id=entity_id)
    people = [{"id": r["person_id"], "name": r["name"], "role": r["role"], "team": r["team"],
               "touches": r["touches"], "via_tickets": r["via_tickets"], "is_owner": r["is_owner"]} for r in rows]
    nodes, edges = [entity_id], []
    for p in people:
        nodes += [p["id"], *p["via_tickets"]]
        if p["touches"] > len(p["via_tickets"]):
            edges.append(edge("WORKED_ON", p["id"], entity_id))
        edges += [e for t in p["via_tickets"] for e in (edge("WORKED_ON", p["id"], t), edge("ABOUT", t, entity_id))]
        if p["is_owner"]:
            edges.append(edge("OWNS", p["id"], entity_id))
    return {"entity_id": entity_id, "people": people}, nodes, edges, []


def get_artifacts(graph, ids):
    """Provenance lookup (not an agent tool): source text, author and time per Artifact id."""
    return run(graph, "get_artifacts", ids=list(ids)) if ids else []


@tool
def equipment_status(graph, store_id, kind=None):
    """Equipment at a store (optionally one kind) with owner and tickets: is a fault known, open, assigned?"""
    rows = run(graph, "equipment_status", store_id=store_id, kind=kind)
    units = {}
    for r in rows:
        u = units.setdefault(r["equipment_id"], {
            "id": r["equipment_id"], "name": r["equipment_name"], "kind": r["kind"], "location": r["location"],
            "owner": {"id": r["owner_id"], "name": r["owner_name"], "role": r["owner_role"]} if r["owner_id"] else None,
            "tickets": []})
        if r["ticket_id"]:
            u["tickets"].append({"id": r["ticket_id"], "title": r["ticket_title"], "status": r["ticket_status"],
                                 "created_at": r["ticket_created_at"],
                                 "assignee": {"id": r["assignee_id"], "name": r["assignee_name"]} if r["assignee_id"] else None,
                                 "unassigned": r["ticket_status"] == "open" and not r["assignee_id"],
                                 "evidence": r["evidence"]})
    nodes, edges, sources = [store_id], [], []
    for u in units.values():
        u["open_unassigned"] = [t["id"] for t in u["tickets"] if t["unassigned"]]
        nodes.append(u["id"])
        edges.append(edge("HAS_EQUIPMENT", store_id, u["id"]))
        if u["owner"]:
            nodes.append(u["owner"]["id"])
            edges.append(edge("OWNS", u["owner"]["id"], u["id"]))
        for t in u["tickets"]:
            nodes += [t["id"], *t["evidence"]]
            edges += [edge("ABOUT", t["id"], u["id"]), *[edge("EVIDENCE_FOR", ev, t["id"]) for ev in t["evidence"]]]
            sources += t["evidence"]
            if t["assignee"]:
                nodes.append(t["assignee"]["id"])
                edges.append(edge("OWNS", t["assignee"]["id"], t["id"]))
    return {"store_id": store_id, "equipment": list(units.values())}, nodes, edges, sources


@tool
def impact_of(graph, supplier_id):
    """What a late supplier breaks: stores and SKUs it feeds, active campaigns on them, and who to tell."""
    rows = run(graph, "impact_of", supplier_id=supplier_id)
    if not rows:
        raise LookupError(f"no supplier {supplier_id} or it supplies nothing stocked")
    r0 = rows[0]
    stores, campaigns = {}, {}
    nodes, edges = [supplier_id, r0["planner_id"]], [edge("OWNS", r0["planner_id"], supplier_id)]
    for r in rows:
        stores.setdefault(r["store_id"], set()).add(r["sku_id"])
        nodes += [r["store_id"], r["sku_id"]]
        edges += [edge("SUPPLIES", supplier_id, r["sku_id"]), edge("STOCKS", r["store_id"], r["sku_id"])]
        if r["campaign_id"]:
            c = campaigns.setdefault(r["campaign_id"], {"id": r["campaign_id"], "name": r["campaign_name"],
                                                        "owner": {"id": r["owner_id"], "name": r["owner_name"]},
                                                        "pairs": []})
            c["pairs"].append([r["store_id"], r["sku_id"]])
            nodes += [r["campaign_id"], r["owner_id"]]
            edges += [edge("PROMOTES", r["campaign_id"], r["sku_id"]), edge("TARGETS", r["campaign_id"], r["store_id"]),
                      edge("OWNS", r["owner_id"], r["campaign_id"])]
    heroes = sorted({r["sku_id"] for r in rows if r["is_hero"]})
    result = {"supplier": {"id": supplier_id, "name": r0["supplier_name"],
                           "planner": {"id": r0["planner_id"], "name": r0["planner_name"]}},
              "stores": {s: sorted(v) for s, v in sorted(stores.items())}, "hero_skus": heroes,
              "active_campaigns": list(campaigns.values())}
    return result, nodes, edges, []


@tool
def connect_path(graph, from_id, to_id, max_len=6):
    """Shortest path between two nodes in either direction: are these two things linked, and how?"""
    rows = run(graph, "connect_path", from_id=from_id, to_id=to_id, max_len=int(max_len))
    if not rows:
        return {"linked": False, "from": from_id, "to": to_id}, [from_id, to_id], [], []
    r = rows[0]
    path = [{"id": i, "label": l} for i, l in zip(r["node_ids"], r["labels"])]
    edges = [edge(t, s, d) for s, t, d in r["edges"]]
    return ({"linked": True, "hops": int(r["hops"]), "path": path, "edges": edges},
            r["node_ids"], edges, [i for i, l in zip(r["node_ids"], r["labels"]) if l == "Artifact"])


@tool
def rank_people(graph, investigation_id):
    """Who should own this incident: people linked to the entities this investigation's Findings cite."""
    rows = run(graph, "rank_people", investigation_id=investigation_id)
    people = [{"id": r["person_id"], "name": r["name"], "role": r["role"], "links": r["links"], "via": r["via"],
               "pagerank": round(r["pagerank"] or 0, 5)} for r in rows]
    return {"people": people}, [p["id"] for p in people], [], []


@tool
def read_findings(graph, investigation_id, agent=None):
    """Shared state: the Findings every agent has written so far for this investigation."""
    rows = run(graph, "read_findings", investigation_id=investigation_id, agent=agent)
    findings = [{"id": r["finding_id"], "agent": r["agent"], "tool": r["tool"], "task_id": r["task_id"],
                 "summary": r["summary"], "data": r["data"], "cites": r["cites"]} for r in rows]
    return {"findings": findings}, [f["id"] for f in findings], [], []


@tool
def recall_memory(graph, alert_id):
    """Past incidents like this alert, and the procedural plan learned for the pattern."""
    rows = run(graph, "recall_memory", alert_id=alert_id)
    memories = [{"id": r["memory_id"], "content": r["content"], "past_alert_id": r["past_alert_id"],
                 "root_cause_kind": r["root_cause_kind"], "root_cause_id": r["root_cause_id"],
                 "similarity": r["similarity"]} for r in rows]
    # Merge the plans of every similar memory: one past pattern must never narrow where this investigation looks.
    plan, seen = None, set()
    for r in rows:
        if not r["procedural_id"] or r["procedural_id"] in seen:
            continue
        seen.add(r["procedural_id"])
        plan = plan or {"ids": [], "departments": [], "root_cause_kinds": [], "content": []}
        plan["ids"].append(r["procedural_id"])
        plan["departments"] += [d for d in json.loads(r["plan"]) if d not in plan["departments"]]
        if r["root_cause_kind"] not in plan["root_cause_kinds"]:
            plan["root_cause_kinds"].append(r["root_cause_kind"])
        plan["content"].append(r["procedural_content"])
    if plan:
        plan["content"] = " ".join(plan["content"])
    nodes = [m["id"] for m in memories] + (plan["ids"] if plan else [])
    return {"memories": memories, "plan": plan}, nodes, [], []

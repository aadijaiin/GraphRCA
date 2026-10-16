"""Agent tools. Each wraps parameterized queries from queries/ and returns the tool result contract
in docs/tool_contract.md: {tool, args, result, touched: {nodes, edges}, sources, error}.

The agent never writes Cypher; it can only call these functions.
"""
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

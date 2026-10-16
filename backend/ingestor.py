"""Ingestor agent: turns a pasted Slack message or ticket update into graph nodes, or rejects it untouched.

Extraction is deterministic (ids by pattern, SKUs and campaigns by name from the graph); validation checks every
reference against the graph before anything is written; the write is one atomic, idempotent Cypher query.
An event that reads as a monitoring alert creates an Alert node, which the orchestrator then investigates:
the two agents hand off only through the graph.
"""
import hashlib
import re
from datetime import datetime, timezone

from state import write
from tools import run

ID_PATTERNS = {
    "Ticket": re.compile(r"\b(?:FAC|ENG|OPS)-\d{3}\b"),
    "Decision": re.compile(r"\bDEC-\d{3}\b"),
    "Campaign": re.compile(r"\bCMP-\d{2}\b"),
    "Alert": re.compile(r"\bALT-\d{3}\b"),
    "Store": re.compile(r"\b[A-Z]{2}-\d{2}\b"),
}
ALERT = re.compile(r"ALERT\s+([A-Z]{2}-\d{2}):\s*promise time up from\s*([\d.]+)\s*to\s*([\d.]+)", re.I)
SIZE = re.compile(r"\s+(\d+(\.\d+)?\s?(ml|l|g|kg|pc|m|bags?)|\d+pc|bunch|1 dozen)$", re.I)
EVIDENCE_TARGETS = ("Ticket", "Decision", "Campaign", "Alert")
KINDS = ("slack", "ticket_text", "sop")


def _base(name):
    return SIZE.sub("", name).strip().lower()


def extract(graph, text):
    """Find what the text refers to. Returns ids by label, named SKUs/campaigns, and an alert if it reads as one."""
    found = {label: sorted(set(p.findall(text))) for label, p in ID_PATTERNS.items()}
    low = text.lower()
    named = {"SKU": [], "Campaign": []}
    for r in sorted(run(graph, "ingest_vocab"), key=lambda r: -len(r["name"])):
        if _base(r["name"]) in low and r["id"] not in named[r["label"]]:
            named[r["label"]].append(r["id"])
    alert = None
    m = ALERT.search(text)
    if m:
        alert = {"store_id": m.group(1).upper(), "before": float(m.group(2)), "after": float(m.group(3)),
                 "sku_ids": named["SKU"]}
    return {"ids": found, "named": named, "alert": alert}


def validate(graph, ex, author_id, kind, text):
    errors = []
    if not text.strip() or len(text) > 2000:
        errors.append("text must be 1 to 2000 characters")
    if kind not in KINDS:
        errors.append(f"kind must be one of {KINDS}")
    refs = {i: label for label, ids in ex["ids"].items() for i in ids}
    refs.update({i: label for label, ids in ex["named"].items() for i in ids})
    refs[author_id] = "Person"
    known = {r["id"]: r["label"] for r in run(graph, "check_ids", ids=sorted(refs))}
    for i, want in sorted(refs.items()):
        if known.get(i) is None:
            errors.append(f"{i} does not exist")
        elif known[i] != want:
            errors.append(f"{i} is a {known[i]}, not a {want}")
    a = ex["alert"]
    if a:
        if len(a["sku_ids"]) != 1:
            errors.append("an alert must name exactly one SKU")
        if not 0 < a["before"] < a["after"] < 120:
            errors.append("alert values must satisfy 0 < before < after < 120")
        if len(a["sku_ids"]) == 1 and known.get(a["store_id"]) == "Store":
            if not run(graph, "check_stocks", store_id=a["store_id"], sku_id=a["sku_ids"][0])[0]["n"]:
                errors.append(f"{a['store_id']} does not stock {a['sku_ids'][0]}")
    return errors


def ingest(graph, text, author_id, kind="slack", channel="#live-events", emit=None):
    ex = extract(graph, text)
    errors = validate(graph, ex, author_id, kind, text)
    if errors:
        return {"ok": False, "errors": errors, "extracted": ex}
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    digest = hashlib.sha1(f"{channel}|{author_id}|{text}".encode()).hexdigest()[:8].upper()
    art_id = f"ART-L{digest}"
    a = ex["alert"]
    alert_id = f"ALT-L{digest}" if a else None
    evidence = [i for label in EVIDENCE_TARGETS for i in ex["ids"][label]] + ex["named"]["Campaign"]
    write(graph, "w_ingest_event", id=art_id, kind=kind, text=text, ts=ts, source_ref=f"{channel}/{digest.lower()}",
          author_id=author_id, evidence_for=sorted(set(evidence)), alert_id=alert_id,
          alert_store_id=a["store_id"] if a else None, alert_sku_id=a["sku_ids"][0] if a else None,
          alert_before=a["before"] if a else None, alert_after=a["after"] if a else None)
    created = [{"node_id": art_id, "label": "Artifact", "props": {"kind": kind, "text": text, "author": author_id},
                "links": [{"type": "EVIDENCE_FOR", "to": e} for e in sorted(set(evidence))]}]
    if alert_id:
        created.append({"node_id": alert_id, "label": "Alert",
                        "props": {"store_id": a["store_id"], "sku_id": a["sku_ids"][0],
                                  "before": a["before"], "after": a["after"]}})
    for c in created:
        if emit:
            emit({"type": "node_created", "ts": ts, "investigation_id": None, "data": c})
    return {"ok": True, "artifact_id": art_id, "alert_id": alert_id, "created": created, "extracted": ex}

"""Scripted backend policies: a fixed, deterministic choice of tool calls per agent.

Each policy sees only what a model would see: its task (in ctx / the instruction) and the payloads its earlier
tool calls returned (history). It makes the same kind of calls the prompts in agents.py ask an LLM to make, so
the multi-agent flow, graph writes and events can be tested and demoed without an API key.
"""
import re

STORE = re.compile(r"\b[A-Z]{2}-\d{2}\b")
EQUIP = re.compile(r"\bEQ-[A-Z0-9]+-[A-Z0-9]+\b")
KINDS = re.compile(r"\b(chiller|freezer|rack|scanner)\b")
SUPPLIER = re.compile(r"\bSUP-\d+\b")
DEFAULT_ROUND_1 = ["store_ops", "growth"]


def _instruction(ctx):
    return ctx.shared["instructions"].get(ctx.task_id, "")


def _calls(history, name):
    return [h for h in history if h["name"] == name]


def _report(history):
    lines = [f"{h['output']['summary']} ({h['output']['finding_id']})" for h in history if h["output"].get("finding_id")]
    return " ".join(lines) or "Nothing relevant found."


def store_ops(history, ctx):
    if not history:
        return [("trace_decision", {"alert_id": ctx.alert["alert_id"]})]
    return _report(history)


def growth(history, ctx):
    if not history:
        return [("find_amplifiers", {"alert_id": ctx.alert["alert_id"]})]
    return _report(history)


def supply(history, ctx):
    if not history:
        m = SUPPLIER.search(_instruction(ctx))
        return [("impact_of", {"supplier_id": m.group(0)})] if m else "No supplier id in the task."
    return _report(history)


def facilities(history, ctx):
    text = _instruction(ctx)
    if not history:
        store = (STORE.findall(text) or [ctx.alert["store_id"]])[0]
        kind = KINDS.search(text)
        return [("equipment_status", {"store_id": store, "kind": kind.group(1) if kind else None})]
    if len(history) == 1:
        units = (history[0]["output"].get("result") or {}).get("equipment", [])
        named = EQUIP.findall(text)
        candidates = [u for u in units if u["open_unassigned"] and (not named or u["id"] in named)]
        if candidates:
            return [("find_expert", {"entity_id": candidates[0]["id"]})]
    return _report(history)


def _instruction_for(dept, alert, plan=None):
    a = alert
    if dept == "store_ops":
        return (f"Find any recent decision that changed how {a['sku_name']} is handled at {a['store_id']}, who made "
                f"it and why.")
    if dept == "growth":
        return f"Check whether any active campaign is pushing {a['sku_name']} in {a['store_id']} around {a['ts']}."
    kinds = [k for k in (plan or {}).get("root_cause_kinds", []) if k in ("chiller", "freezer", "rack", "scanner")]
    if dept == "facilities" and kinds:
        return (f"Memory: a similar past incident was caused by a {kinds[0]}. Check {kinds[0]} units at "
                f"{a['store_id']} for open unassigned tickets and who should fix them.")
    return f"Investigate alert {a['alert_id']} at {a['store_id']} for your department."


def _equipment_cause(dispatches):
    for d in dispatches:
        for f in d["output"].get("findings", []):
            if f["tool"] == "trace_decision" and (f["data"] or {}).get("decision"):
                for c in f["data"]["causes"]:
                    if c["label"] == "Equipment":
                        return c
    return None


def orchestrator(history, ctx):
    a = ctx.alert
    if not history:
        return [("recall_memory", {})]
    dispatches = _calls(history, "dispatch")
    if not dispatches:
        mem = history[0]["output"].get("result") or {}
        plan = mem.get("plan")
        # Memory can add departments to round 1, never remove the defaults.
        depts = list(dict.fromkeys(DEFAULT_ROUND_1 + (plan["departments"] if plan else [])))
        return [("dispatch", {"department": d, "instruction": _instruction_for(d, a, plan)}) for d in depts]
    done = {d["input"]["department"] for d in dispatches}
    if "facilities" not in done:
        eq = _equipment_cause(dispatches)
        if eq:
            return [("dispatch", {"department": "facilities", "instruction":
                     f"Store Ops traced the move at {a['store_id']} to {eq['id']} ({eq['name']}). Check its tickets "
                     f"and who should fix it."})]
    draft = compose(ctx, dispatches)
    if draft["root_cause_id"] and draft["amplifier_id"] and not _calls(history, "connect_path"):
        return [("connect_path", {"from_id": draft["amplifier_id"], "to_id": draft["root_cause_id"]})]
    if not _calls(history, "submit_answer"):
        return [("submit_answer", compose(ctx, dispatches, _calls(history, "connect_path")))]
    return "Answer submitted."


def compose(ctx, dispatches, paths=()):
    """Build submit_answer arguments from department Findings only."""
    a = ctx.alert
    by_tool = {}
    for d in dispatches:
        for f in d["output"].get("findings", []):
            by_tool.setdefault(f["tool"], f)
    alert_f = ctx.shared.get("alert_finding")
    trace, amps = by_tool.get("trace_decision"), by_tool.get("find_amplifiers")
    status, expert = by_tool.get("equipment_status"), by_tool.get("find_expert")
    claims, actions = [], []
    if alert_f:
        claims.append({"text": f"{a['store_id']} {a['metric']} rose from {a['before']} to {a['after']}; the alert "
                               f"attributes it to {a['sku_name']}.", "finding_ids": [alert_f]})
    t = (trace or {}).get("data") or {}
    eq = None
    if t.get("decision"):
        d, au = t["decision"], t["author"]
        claims.append({"text": f"{au['name']} ({au['role']}) moved {a['sku_name']} from {d['moved_from']} to "
                               f"{d['moved_to']} at {d['decided_at']} ({d['id']}).", "finding_ids": [trace["id"]]})
        eq = next((c for c in t["causes"] if c["label"] == "Equipment"), None)
        for c in t["causes"]:
            if c["label"] == "Ticket":
                ids = [trace["id"]]
                state = "unassigned" if c["unassigned"] else f"assigned to {c['owner']['name']}"
                claims.append({"text": f"The move was made because of ticket {c['id']} ({c['name']}), status "
                                       f"{c['status']}, {state}.", "finding_ids": ids})
    campaigns = ((amps or {}).get("data") or {}).get("campaigns", [])
    for cm in campaigns:
        claims.append({"text": f"Campaign {cm['name']} ({cm['id']}), owned by {cm['owner']['name']}, went live "
                               f"{cm['hours_before_alert']}h before the alert and promotes {a['sku_name']} in "
                               f"{a['store_id']}.", "finding_ids": [amps["id"]]})
    for h in paths:
        res = h["output"].get("result") or {}
        if res.get("linked") and h["output"].get("finding_id"):
            hops = " -> ".join(f"{e['from']} {e['type']} {e['to']}" for e in res["edges"])
            claims.append({"text": f"{res['path'][0]['id']} and {res['path'][-1]['id']} are linked in the graph in "
                                   f"{res['hops']} hops: {hops}.", "finding_ids": [h["output"]["finding_id"]]})
    root = eq["id"] if eq else (campaigns[0]["id"] if campaigns else None)
    amplifier = campaigns[0]["id"] if eq and campaigns else None
    if amplifier:
        cm = campaigns[0]
        actions.append({"text": f"Pause {cm['name']} for {a['store_id']}; tell {cm['owner']['name']}.",
                        "finding_ids": [amps["id"], trace["id"]]})
    elif campaigns:
        cm = campaigns[0]
        actions.append({"text": f"Ask {cm['owner']['name']} to cap {cm['name']} in {a['store_id']} or raise "
                                f"replenishment for {a['sku_name']}.", "finding_ids": [amps["id"]]})
    if eq and eq["owner"]:
        for c in t["causes"]:
            if c["label"] == "Ticket" and c["unassigned"]:
                people = ((expert or {}).get("data") or {}).get("people", [])
                top = next((p for p in people if not p["is_owner"]), None)
                hint = f"; {top['name']} has the most history with this unit" if top else ""
                actions.append({"text": f"Assign {c['id']} to {eq['owner']['name']} ({eq['owner']['role']}), who "
                                        f"owns {eq['name']}{hint}.",
                                "finding_ids": [trace["id"]]
                                + ([status["id"]] if status and _status_has(status, eq["id"], c["id"]) else [])
                                + ([expert["id"]] if expert else [])})
    if eq and amplifier:
        summary = (f"Root cause: {eq['name']} at {a['store_id']} is down, so {a['sku_name']} was moved far from "
                   f"packing. Amplifier: {campaigns[0]['name']} pushed demand for it.")
    elif eq:
        summary = f"Root cause: {eq['name']} at {a['store_id']}."
    elif campaigns:
        summary = f"Root cause: demand from {campaigns[0]['name']} on {a['sku_name']} at {a['store_id']}."
    else:
        summary = "Inconclusive: no decision or campaign in the graph explains this alert."
    return {"summary": summary, "root_cause_id": root, "amplifier_id": amplifier, "claims": claims, "actions": actions}


def _status_has(status_finding, equipment_id, ticket_id):
    for u in (status_finding.get("data") or {}).get("equipment", []):
        if u["id"] == equipment_id and ticket_id in u["open_unassigned"]:
            return True
    return False


POLICIES = {"orchestrator": orchestrator, "store_ops": store_ops, "growth": growth, "facilities": facilities,
            "supply": supply}

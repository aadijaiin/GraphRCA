"""Agents: one generic runner plus configurations (prompt + tool subset) for the orchestrator and departments.

Agents coordinate only through the graph. The orchestrator writes Task nodes; each department agent runs its own
loop and every graph-tool call it makes writes a Finding. Departments can read each other's Findings with
read_findings. The orchestrator answers only by citing Finding ids, and the validator checks each one.
"""
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field, replace
from typing import Callable

from tools import TOOLS, run

MAX_CALLS = 8    # tool calls per agent loop
MAX_TASKS = 6    # department tasks per investigation
ROOT_LABELS = ("Equipment", "Campaign", "Supplier", "Decision")
MAX_PARALLEL = int(os.getenv("BRAIN_MAX_PARALLEL", "4"))  # departments running at once (API rate limits)
REF = re.compile(r"\bF\d+\b")
# Look-alike dashes models put in ids (gpt-oss writes EQ\u2011NO05\u2011RACK3 with non-breaking hyphens), plus
# zero-width characters. Ids in the graph only ever use "-".
_DASHES = str.maketrans({c: "-" for c in "\u2010\u2011\u2012\u2013\u2014\u2015\u2212\ufe58\ufe63\uff0d"}
                        | {c: None for c in "\u200b\u200c\u200d\u2060\ufeff"})


def normalize_id(value):
    """An id as the graph spells it: ASCII hyphens, no zero-width characters, no surrounding spaces."""
    return value.translate(_DASHES).strip() if isinstance(value, str) else value


@dataclass
class ToolSpec:
    name: str
    description: str
    params: dict
    handler: Callable

    def schema(self):
        return {"name": self.name, "description": self.description, "strict": True,
                "input_schema": {"type": "object", "properties": self.params,
                                 "required": list(self.params), "additionalProperties": False}}


@dataclass
class Agent:
    name: str
    system: str
    tools: list
    finish_with: str = None  # a tool the agent must call to finish; it is reminded once if it stops without it


@dataclass
class Ctx:
    graph: str
    inv: object       # state.Investigation
    backend: object
    alert: dict
    agent: str = "orchestrator"
    task_id: str = None
    shared: dict = field(default_factory=dict)  # per-investigation: round counter, answer, dispatch order


def _emit_call(ctx, tool, args, r=None):
    step = ctx.inv.next_id("S")
    ctx.inv.emit("tool_call", step=step, agent=ctx.agent, tool=tool, args=args)
    if r is not None:
        if r["touched"]["nodes"]:
            ctx.inv.emit("nodes_touched", step=step, agent=ctx.agent, node_ids=r["touched"]["nodes"])
        if r["touched"]["edges"]:
            ctx.inv.emit("edges_touched", step=step, agent=ctx.agent, edges=r["touched"]["edges"])
    return step


def graph_tool(name, description, params, finding=True, bind_alert=False):
    """A department tool: runs one query-backed tool, emits events, and writes a Finding from the result.
    bind_alert: the alert id comes from the investigation, not the model (models confused it with Finding refs)."""
    def handler(ctx, **args):
        if bind_alert:
            args = {**args, "alert_id": ctx.alert["alert_id"]}
        r = TOOLS[name](ctx.graph, **args)
        _emit_call(ctx, name, args, r)
        payload = {"result": r["result"], "error": r["error"]}
        if finding and not r["error"]:
            payload["finding"], payload["summary"] = ctx.inv.finding(ctx.agent, ctx.task_id, r)
        return payload
    return ToolSpec(name, description, params, handler)


def _read_findings(ctx, agent=None):
    r = TOOLS["read_findings"](ctx.graph, investigation_id=ctx.inv.id, agent=agent)
    _emit_call(ctx, "read_findings", {"agent": agent}, r)
    if r["error"]:
        return {"error": r["error"]}
    # Summaries and cited ids only, no raw data: keeps small-context models within budget.
    return {"findings": [{"ref": ctx.inv.ref_of.get(f["id"], f["id"]), "agent": f["agent"], "tool": f["tool"],
                          "summary": f["summary"], "cites": f["cites"]} for f in r["result"]["findings"]]}


STR, NSTR = {"type": "string"}, {"type": ["string", "null"]}
KIND = {"type": ["string", "null"], "enum": ["chiller", "freezer", "rack", "scanner", None]}

T_ALERT = graph_tool("get_alert", "This investigation's alert: its store, SKU, metric and values.", {},
                     bind_alert=True)
T_TRACE = graph_tool(
    "trace_decision",
    "Latest decision that moved the alert's SKU in the alert's store before the alert: who made it, what it "
    "changed, its causes (tickets, equipment) with owner/assignee, and source messages.", {}, bind_alert=True)
T_AMPS = graph_tool(
    "find_amplifiers",
    "Active campaigns that promote the alert's SKU in the alert's store and started before the alert, with "
    "owners and launch messages.", {}, bind_alert=True)
T_EXPERT = graph_tool("find_expert", "People ranked by work history on an entity (equipment, ticket, SKU).",
                      {"entity_id": STR})
T_EQUIP = graph_tool(
    "equipment_status",
    "Equipment at a store (optionally one kind) with each unit's owner and tickets, flagging open unassigned "
    "tickets.", {"store_id": STR, "kind": KIND})
T_IMPACT = graph_tool("impact_of",
                      "What a late supplier breaks: stores and SKUs it feeds, active campaigns on them, owners.",
                      {"supplier_id": STR})
T_SEARCH = graph_tool("search_artifacts",
                      "Keyword search over Slack messages, SOPs, ticket text, ticket titles and SKU names. Hits are "
                      "leads, not evidence. Use it only when your main tool found nothing, at most once.",
                      {"text": STR})
T_PATH = graph_tool("connect_path", "Shortest path between two node ids in either direction (a link, not proof).",
                    {"from_id": STR, "to_id": STR})
def _rank_people(ctx, **_ignored):  # some models pass alert_id or similar; this tool needs none
    r = TOOLS["rank_people"](ctx.graph, investigation_id=ctx.inv.id)
    _emit_call(ctx, "rank_people", {}, r)
    payload = {"result": r["result"], "error": r["error"]}
    if not r["error"]:
        payload["finding"], payload["summary"] = ctx.inv.finding(ctx.agent, ctx.task_id, r)
    return payload


T_RANK = ToolSpec("rank_people", "People most connected (OWNS, WORKED_ON) to the entities this investigation's "
                  "Findings cite, with PageRank as tie-break: who should own the incident.", {}, _rank_people)
T_READ = ToolSpec("read_findings",
                  "Findings every agent has written so far for this investigation (the shared state). "
                  "Pass a department name to filter, or null for all.",
                  {"agent": {"type": ["string", "null"], "enum": ["store_ops", "facilities", "growth", "supply",
                                                                  "orchestrator", None]}},
                  _read_findings)

WRITING = (
    "Write for a store operations manager, not a programmer: name people, items, stores, equipment and campaigns "
    "by name with the id in parentheses, e.g. Front chiller A1 (EQ-SD04-CHA1) or Vikram Sethi (PER-001); say "
    "\"promise time\" rather than promise_time_min; write times like 16 Oct 08:30 UTC; use plain hyphens in ids; "
    "never put tool names, field names or JSON in your prose.")

DEPT_RULES = (
    "You work for DashMart, a fictional quick-commerce company (all data is synthetic). You investigate by calling "
    "your tools; every tool call is recorded as a Finding that other agents can read. Use only your tools, never "
    "guess ids, and stop as soon as your task is answered: most tasks need 1 to 3 tool calls, and the main tool for "
    "your department usually answers it in one. Finish with a short plain report (2 to 4 sentences) of "
    "what you found and the Finding refs that support it. If your tools show nothing relevant, say so. " + WRITING)

DEPARTMENTS = {
    "store_ops": Agent("store_ops", "You are the Store Ops agent: store decisions, product placement and pick "
                       "flow. " + DEPT_RULES, [T_ALERT, T_TRACE, T_SEARCH, T_READ]),
    "facilities": Agent("facilities", "You are the Facilities agent: equipment, faults, facilities tickets and "
                        "who should fix them. " + DEPT_RULES, [T_EQUIP, T_EXPERT, T_SEARCH, T_READ]),
    "growth": Agent("growth", "You are the Growth agent: campaigns, promotions and the demand they create. "
                    + DEPT_RULES, [T_ALERT, T_AMPS, T_SEARCH, T_READ]),
    "supply": Agent("supply", "You are the Supply agent: suppliers, inbound stock and what a delay breaks. "
                    + DEPT_RULES, [T_IMPACT, T_SEARCH, T_READ]),
}


# ---- runner ----

_TYPES = {"string": str, "array": list, "object": dict, "null": type(None), "integer": int, "number": (int, float),
          "boolean": bool}


def check_args(spec, args):
    """Check tool arguments against the tool's schema, since self-hosted servers do not enforce it.
    Unknown keys are dropped; missing keys, wrong types, values outside an enum, and Finding refs (F3) passed
    where a node id belongs are errors the model can fix. Returns (clean_args, problem)."""
    clean = {k: normalize_id(v) for k, v in args.items() if k in spec.params}
    for k, prop in spec.params.items():
        if k not in clean:
            if "null" in (prop["type"] if isinstance(prop["type"], list) else [prop["type"]]):
                clean[k] = None
                continue
            return clean, f"missing argument {k!r}"
        v = clean[k]
        types = prop["type"] if isinstance(prop["type"], list) else [prop["type"]]
        if not any(isinstance(v, _TYPES[t]) for t in types):
            return clean, f"{k!r} must be {' or '.join(types)}"
        if "enum" in prop and v not in prop["enum"]:
            return clean, f"{k!r} must be one of {[e for e in prop['enum'] if e is not None]}" + (
                " or null" if None in prop["enum"] else "")
        if isinstance(v, str) and REF.fullmatch(v.strip()):
            return clean, (f"{v!r} is a Finding ref, used only to cite evidence in submit_answer; {k!r} needs a "
                           f"node id from the Findings, such as ALT-001, EQ-SD04-CHA1 or CMP-01")
    return clean, None


def _tool_result_block(call_id, payload):
    return {"type": "tool_result", "tool_use_id": call_id, "content": json.dumps(payload, default=str),
            **({"is_error": True} if payload.get("error") else {})}


def run_agent(ctx, agent, task_text, max_calls=MAX_CALLS):
    """Generic agent loop. Returns the agent's final text."""
    specs = {t.name: t for t in agent.tools}
    schemas = [t.schema() for t in agent.tools]
    messages = [{"role": "user", "content": task_text}]
    history, used, reminded = [], 0, False
    for _ in range(max_calls + 3):
        ctx.inv.emit("model_started", agent=agent.name, backend=ctx.backend.name)
        t0 = time.monotonic()
        turn = ctx.backend.step(agent.name, agent.system, schemas, messages, history, ctx)
        ctx.inv.emit("model_turn", agent=agent.name, seconds=round(time.monotonic() - t0, 1),
                     tool_calls=[c.name for c in turn.calls])
        messages.append({"role": "assistant", "content": turn.content})
        if not turn.calls:
            if agent.finish_with and ctx.shared.get("answer") is None and not reminded:
                reminded = True  # smaller models sometimes answer in prose; ask once for the required call
                messages.append({"role": "user", "content": f"Call {agent.finish_with} now to finish. Plain text "
                                                            f"is not recorded as an answer."})
                continue
            return turn.text.strip()

        def execute(call, over_budget):
            spec = specs.get(call.name)
            if spec is None:
                return {"error": f"unknown tool {call.name!r}; your tools are: {', '.join(specs)}"}
            if over_budget:
                return {"error": "tool call budget exhausted; give your final report now"}
            if call.input is None:
                return {"error": f"arguments for {call.name} were not a valid JSON object; call it again"}
            args, problem = check_args(spec, call.input)
            if problem:
                return {"error": f"{call.name}: {problem}"}
            try:
                return spec.handler(ctx, **args)
            except TypeError as e:
                return {"error": f"bad arguments: {e}"}

        if any(c.name == "dispatch" for c in turn.calls) and ctx.shared.get("before_dispatch"):
            ctx.shared["before_dispatch"]()
        budget = [used + i >= max_calls for i in range(len(turn.calls))]
        used += len(turn.calls)
        outputs = [execute(c, b) for c, b in zip(turn.calls, budget)]  # parallelism lives inside dispatch
        messages.append({"role": "user", "content": [_tool_result_block(c.id, o) for c, o in zip(turn.calls, outputs)]})
        history.extend({"name": c.name, "input": c.input, "output": o} for c, o in zip(turn.calls, outputs))
        if ctx.shared.get("answer") is not None:
            return turn.text.strip() or "Answer submitted."
    return "Stopped: tool call budget exhausted."


# ---- orchestrator ----

def _recall(ctx, **_ignored):
    r = TOOLS["recall_memory"](ctx.graph, alert_id=ctx.alert["alert_id"])
    _emit_call(ctx, "recall_memory", {"alert_id": ctx.alert["alert_id"]}, r)
    if not r["error"]:
        ctx.inv.emit("memory_recalled", memories=r["result"]["memories"], plan=r["result"]["plan"])
    return {"result": r["result"], "error": r["error"]}


def _run_task(ctx, tid, department, instruction):
    """One department task, on its own thread. Never raises: a failing agent marks only its own task failed."""
    a = ctx.alert
    task = (f"Task {tid} from the orchestrator: {instruction}\n\nAlert {a['alert_id']} at store {a['store_id']}, "
            f"SKU {a['sku_id']} ({a['sku_name']}), {a['metric']} {a['before']} -> {a['after']} at {a['ts']}.")
    sub = replace(ctx, agent=department, task_id=tid)
    try:
        report, status = run_agent(sub, DEPARTMENTS[department], task), "done"
    except Exception as e:  # model error, refusal, timeout: the other departments carry on
        report, status = f"failed: {type(e).__name__}: {e}", "failed"
    mine = [f for f in ctx.inv.findings().values() if f["task_id"] == tid]
    refs = [ctx.inv.ref_of.get(f["finding_id"], f["finding_id"]) for f in mine]
    unverified = sorted(set(REF.findall(report)) - set(refs))
    ctx.inv.complete_task(tid, department, report, [f["finding_id"] for f in mine], status, unverified)
    return {"task_id": tid, "department": department, "status": status, "report": report,
            "findings": [{"ref": r, "tool": f["tool"], "summary": f["summary"]} for r, f in zip(refs, mine)],
            # refs a report mentions that are not this task's Findings: the report is not evidence for them
            "unverified_refs": unverified}


def _dispatch(ctx, tasks):
    """Run several department tasks in parallel from one call. Bad items are rejected one by one."""
    accepted, rejected = [], []
    rnd = ctx.shared["round"]
    with ctx.inv._lock:
        busy = ctx.shared["round_depts"].setdefault(rnd, set())
        for t in tasks or []:
            dept = (t or {}).get("department")
            instr = ((t or {}).get("instruction") or "").strip()
            if dept not in DEPARTMENTS:
                rejected.append({"department": dept, "error": f"unknown department; use one of {list(DEPARTMENTS)}"})
            elif dept in busy:
                rejected.append({"department": dept, "error": "already dispatched this round; merge the instructions"})
            elif not instr:
                rejected.append({"department": dept, "error": "empty instruction"})
            elif len(ctx.shared["order"]) + len(accepted) >= MAX_TASKS:
                rejected.append({"department": dept, "error": f"task limit ({MAX_TASKS}) reached; submit your answer"})
            else:
                busy.add(dept)
                accepted.append((dept, instr))
        for dept, _ in accepted:
            ctx.shared["order"].append((rnd, list(DEPARTMENTS).index(dept), dept))
    created = []
    for dept, instr in accepted:  # create Task nodes in a stable order before any department starts
        tid = ctx.inv.task(dept, instr, rnd)
        ctx.shared["instructions"][tid] = instr
        created.append((tid, dept, instr))
    results = []
    if created:
        with ThreadPoolExecutor(min(MAX_PARALLEL, len(created))) as pool:
            results = list(pool.map(lambda c: _run_task(ctx, *c), created))
    return {"round": rnd, "results": results + rejected,
            "note": "Reports are each department's own words. Only Findings are evidence: cite Finding refs."}


def validate_answer(ctx, raw):
    """Keep only claims and actions whose finding_ids are Findings of this investigation; attach their sources
    from the graph; accept root_cause/amplifier only if a kept Finding cites them."""
    findings = ctx.inv.findings()
    kept, dropped = {"claims": [], "actions": []}, []
    for key in ("claims", "actions"):
        for c in raw.get(key) or []:
            ids = [ctx.inv.resolve(normalize_id(i)) for i in c.get("finding_ids") or []]
            if ids and all(i in findings for i in ids):
                kept[key].append({"text": c["text"], "finding_ids": ids})
            else:
                dropped.append({**c, "kind": key, "reason": "no finding_ids" if not ids else "unknown finding id"})
    used = {i for k in kept.values() for c in k for i in c["finding_ids"]}
    rows = run(ctx.graph, "finding_sources", investigation_id=ctx.inv.id, finding_ids=sorted(used))
    srcs = {r["finding_id"]: r["sources"] for r in rows}
    for c in kept["claims"]:
        # Keyword-search hits are leads, not evidence: use them only if no structural Finding backs the claim,
        # and then only the top 3.
        strong = [i for i in c["finding_ids"] if findings[i]["tool"] != "search_artifacts"]
        if strong:
            c["sources"] = list(dict.fromkeys(s for i in strong for s in srcs.get(i, [])))
        else:
            c["sources"] = list(dict.fromkeys(s for i in c["finding_ids"] for s in srcs.get(i, [])[:3]))
    cited = {n for i in used for n in findings[i]["cites"]}

    structural = {n for i in used if findings[i]["tool"] != "search_artifacts" for n in findings[i]["cites"]}

    def entity(eid, what):
        eid = normalize_id(eid)
        if not eid:
            return None
        rows = run(ctx.graph, "node_brief", id=eid)
        if not rows:
            dropped.append({"kind": what, "id": eid, "reason": "no such node"})
            return None
        b = rows[0]
        if what == "amplifier" and b["label"] != "Campaign":
            dropped.append({"kind": what, "id": eid, "reason": f"an amplifier must be a Campaign, not a {b['label']}"})
            return None
        if what == "root_cause" and b["label"] == "Ticket":  # the ticket records the fault; the unit is the cause
            subject = run(ctx.graph, "ticket_subject", id=eid)
            if subject:
                eid, b = subject[0]["equipment_id"], run(ctx.graph, "node_brief", id=subject[0]["equipment_id"])[0]
        if what == "root_cause" and b["label"] not in ROOT_LABELS:
            dropped.append({"kind": what, "id": eid, "reason": f"a root cause must be one of {ROOT_LABELS}"})
            return None
        if eid not in cited:
            dropped.append({"kind": what, "id": eid, "reason": "not cited by a kept finding"})
            return None
        if eid not in structural:  # keyword hits alone cannot establish a cause (and would poison memory)
            dropped.append({"kind": what, "id": eid, "reason": "only keyword-search findings mention it"})
            return None
        name = f"{b['name']} at {ctx.alert['store_id']}" if b["label"] == "Equipment" else b["name"]
        return {"id": eid, "label": b["label"], "name": name,
                "kind": b["kind"] if b["label"] == "Equipment" else b["label"].lower()}

    answer = {"summary": raw.get("summary") or "", "root_cause": entity(raw.get("root_cause_id"), "root_cause"),
              "amplifier": entity(raw.get("amplifier_id"), "amplifier"), **kept}
    return answer, dropped


def _submit(ctx, summary, root_cause_id, amplifier_id, claims, actions):
    answer, dropped = validate_answer(ctx, {"summary": summary, "root_cause_id": root_cause_id,
                                            "amplifier_id": amplifier_id, "claims": claims, "actions": actions})
    ctx.shared["answer"], ctx.shared["dropped"] = answer, dropped
    _emit_call(ctx, "submit_answer", {"root_cause_id": root_cause_id, "amplifier_id": amplifier_id})
    return {"accepted_claims": len(answer["claims"]), "accepted_actions": len(answer["actions"]), "dropped": dropped}


CLAIM = {"type": "array", "items": {"type": "object", "additionalProperties": False, "required": ["text", "finding_ids"],
                                    "properties": {"text": STR, "finding_ids": {"type": "array", "items": STR}}}}

ORCHESTRATOR = Agent(
    "orchestrator",
    "You are the orchestrator of DashMart Brain, investigating an operational alert at DashMart, a fictional "
    "quick-commerce company (all data is synthetic). You do not query the company graph yourself: you dispatch "
    "department agents and reason over the Findings they write.\n\n"
    "Departments: store_ops (store decisions, placement, pick flow), facilities (equipment, faults, tickets, who "
    "fixes them), growth (campaigns and demand), supply (suppliers and inbound stock).\n\n"
    "How to work:\n"
    "1. Call recall_memory first. Then make ONE dispatch call for round 1 containing store_ops and growth, plus "
    "every department in the memory plan if one is returned; they run in parallel. Add the plan's departments and pass the memory's hint in the instruction. A memory is a hint "
    "about where to look first, not evidence: confirm it with this investigation's Findings.\n"
    "2. Put all independent tasks in a single dispatch call. A department's report is its own summary, not "
    "evidence: rely on the Findings listed with it.\n"
    "3. When one department's Finding opens work for another (for example Store Ops finds a decision caused by "
    "broken equipment), dispatch that department next with the specific ids. At most 6 tasks in total.\n"
    "4. Use connect_path to check whether entities from different departments' Findings are actually linked "
    "(for example a campaign and a broken unit in the same store), and rank_people to see who is most connected "
    "to the incident.\n"
    "5. Finish with submit_answer. Every claim and action must list the Finding refs (F1, F2, ...) that support it; claims "
    "without valid Finding ids are dropped. root_cause_id and amplifier_id must be node ids that a cited "
    "Finding mentions. The root cause is the thing that failed (usually Equipment, otherwise a Campaign, Supplier "
    "or Decision; a ticket only records a fault). The amplifier, if any, must be a Campaign that made it worse. Use null when "
    "there is none.\n\n"
    "Write each claim as one specific fact with names and ids: who decided what, when, and why (for example the "
    "decision id, the person, the equipment, the ticket and its status). Write each action as an instruction to a "
    "named person, using the owners the Findings report:\n"
    "- an open ticket with no assignee: assign it to the owner of the equipment it is about (not close it);\n"
    "- an active campaign that amplifies the problem: pause or cap it for that store and tell its owner;\n"
    "- a demand spike with no fault: ask the campaign owner to cap it or raise replenishment.\n"
    "Cite the Findings that name each owner.\n\n"
    "Task instructions you send to departments and everything in submit_answer are read by people. " + WRITING,
    [ToolSpec("recall_memory", "Past incidents similar to this alert and the plan learned for the pattern.", {},
              _recall),
     ToolSpec("dispatch", "Give tasks to one or more departments in ONE call; they run in parallel. Returns each "
              "department's report and the Findings it wrote.",
              {"tasks": {"type": "array", "minItems": 1, "items": {
                  "type": "object", "additionalProperties": False, "required": ["department", "instruction"],
                  "properties": {"department": {"type": "string", "enum": list(DEPARTMENTS)}, "instruction": STR}}}},
              _dispatch),
     T_READ, T_PATH, T_RANK,
     ToolSpec("submit_answer", "Submit the final answer. Ends the investigation.",
              {"summary": STR, "root_cause_id": NSTR, "amplifier_id": NSTR, "claims": CLAIM, "actions": CLAIM},
              _submit)],
    finish_with="submit_answer")

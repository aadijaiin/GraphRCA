"""Agents: one generic runner plus configurations (prompt + tool subset) for the orchestrator and departments.

Agents coordinate only through the graph. The orchestrator writes Task nodes; each department agent runs its own
loop and every graph-tool call it makes writes a Finding. Departments can read each other's Findings with
read_findings. The orchestrator answers only by citing Finding ids, and the validator checks each one.
"""
import json
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field, replace
from typing import Callable

from tools import TOOLS, run

MAX_CALLS = 8    # tool calls per agent loop
MAX_TASKS = 6    # department tasks per investigation (rounds are not capped: some models dispatch one per turn)


@dataclass
class ToolSpec:
    name: str
    description: str
    params: dict
    handler: Callable
    parallel: bool = False  # several calls in one turn run concurrently

    def schema(self):
        return {"name": self.name, "description": self.description, "strict": True,
                "input_schema": {"type": "object", "properties": self.params,
                                 "required": list(self.params), "additionalProperties": False}}


@dataclass
class Agent:
    name: str
    system: str
    tools: list


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


def graph_tool(name, description, params, finding=True):
    """A department tool: runs one query-backed tool, emits events, and writes a Finding from the result."""
    def handler(ctx, **args):
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

T_ALERT = graph_tool("get_alert", "The alert's store, SKU, metric and values.", {"alert_id": STR})
T_TRACE = graph_tool(
    "trace_decision",
    "Latest decision that moved the alert's SKU in the alert's store before the alert: who made it, what it "
    "changed, its causes (tickets, equipment) with owner/assignee, and source messages.", {"alert_id": STR})
T_AMPS = graph_tool(
    "find_amplifiers",
    "Active campaigns that promote the alert's SKU in the alert's store and started before the alert, with "
    "owners and launch messages.", {"alert_id": STR})
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
                      "Full-text search over Slack messages, SOPs, ticket text, ticket titles and SKU names.",
                      {"text": STR})
T_PATH = graph_tool("connect_path", "Shortest path between two node ids in either direction (a link, not proof).",
                    {"from_id": STR, "to_id": STR})
def _rank_people(ctx):
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

DEPT_RULES = (
    "You work for DashMart, a fictional quick-commerce company (all data is synthetic). You investigate by calling "
    "your tools; every tool call is recorded as a Finding that other agents can read. Use only your tools, never "
    "guess ids, and stop as soon as your task is answered. Finish with a short plain report (2 to 4 sentences) of "
    "what you found and the Finding ids that support it. If your tools show nothing relevant, say so.")

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

def _tool_result_block(call_id, payload):
    return {"type": "tool_result", "tool_use_id": call_id, "content": json.dumps(payload, default=str),
            **({"is_error": True} if payload.get("error") else {})}


def run_agent(ctx, agent, task_text, max_calls=MAX_CALLS):
    """Generic agent loop. Returns the agent's final text."""
    specs = {t.name: t for t in agent.tools}
    schemas = [t.schema() for t in agent.tools]
    messages = [{"role": "user", "content": task_text}]
    history, used = [], 0
    for _ in range(max_calls + 2):
        turn = ctx.backend.step(agent.name, agent.system, schemas, messages, history, ctx)
        messages.append({"role": "assistant", "content": turn.content})
        if not turn.calls:
            return turn.text.strip()

        def execute(call, over_budget):
            spec = specs.get(call.name)
            if spec is None:
                return {"error": f"unknown tool {call.name}"}
            if over_budget:
                return {"error": "tool call budget exhausted; give your final report now"}
            try:
                return spec.handler(ctx, **call.input)
            except TypeError as e:
                return {"error": f"bad arguments: {e}"}

        if any(c.name == "dispatch" for c in turn.calls) and ctx.shared.get("before_dispatch"):
            ctx.shared["before_dispatch"]()
        budget = [used + i >= max_calls for i in range(len(turn.calls))]
        used += len(turn.calls)
        if len(turn.calls) > 1 and all(specs.get(c.name) and specs[c.name].parallel for c in turn.calls):
            with ThreadPoolExecutor(len(turn.calls)) as pool:
                outputs = list(pool.map(execute, turn.calls, budget))
        else:
            outputs = [execute(c, b) for c, b in zip(turn.calls, budget)]
        messages.append({"role": "user", "content": [_tool_result_block(c.id, o) for c, o in zip(turn.calls, outputs)]})
        history.extend({"name": c.name, "input": c.input, "output": o} for c, o in zip(turn.calls, outputs))
        if ctx.shared.get("answer") is not None:
            return turn.text.strip() or "Answer submitted."
    return "Stopped: tool call budget exhausted."


# ---- orchestrator ----

def _recall(ctx):
    r = TOOLS["recall_memory"](ctx.graph, alert_id=ctx.alert["alert_id"])
    _emit_call(ctx, "recall_memory", {"alert_id": ctx.alert["alert_id"]}, r)
    if not r["error"]:
        ctx.inv.emit("memory_recalled", memories=r["result"]["memories"], plan=r["result"]["plan"])
    return {"result": r["result"], "error": r["error"]}


def _dispatch(ctx, department, instruction):
    if department not in DEPARTMENTS:
        return {"error": f"unknown department {department}"}
    if len(ctx.shared["order"]) >= MAX_TASKS:
        return {"error": f"task limit ({MAX_TASKS}) reached; submit your answer"}
    tid = ctx.inv.task(department, instruction, ctx.shared["round"])
    ctx.shared["instructions"][tid] = instruction
    with ctx.inv._lock:
        ctx.shared["order"].append((ctx.shared["round"], list(DEPARTMENTS).index(department), department))
    a = ctx.alert
    task = (f"Task {tid} from the orchestrator: {instruction}\n\nAlert {a['alert_id']} at store {a['store_id']}, "
            f"SKU {a['sku_id']} ({a['sku_name']}), {a['metric']} {a['before']} -> {a['after']} at {a['ts']}.")
    sub = replace(ctx, agent=department, task_id=tid)
    report = run_agent(sub, DEPARTMENTS[department], task)
    mine = [f for f in ctx.inv.findings().values() if f["task_id"] == tid]
    ctx.inv.complete_task(tid, department, report, [f["finding_id"] for f in mine])
    return {"task_id": tid, "department": department, "report": report,
            "findings": [{"ref": ctx.inv.ref_of.get(f["finding_id"], f["finding_id"]), "tool": f["tool"],
                          "summary": f["summary"]} for f in mine]}


def validate_answer(ctx, raw):
    """Keep only claims and actions whose finding_ids are Findings of this investigation; attach their sources
    from the graph; accept root_cause/amplifier only if a kept Finding cites them."""
    findings = ctx.inv.findings()
    kept, dropped = {"claims": [], "actions": []}, []
    for key in ("claims", "actions"):
        for c in raw.get(key) or []:
            ids = [ctx.inv.resolve(i) for i in c.get("finding_ids") or []]
            if ids and all(i in findings for i in ids):
                kept[key].append({"text": c["text"], "finding_ids": ids})
            else:
                dropped.append({**c, "kind": key, "reason": "no finding_ids" if not ids else "unknown finding id"})
    used = {i for k in kept.values() for c in k for i in c["finding_ids"]}
    rows = run(ctx.graph, "finding_sources", investigation_id=ctx.inv.id, finding_ids=sorted(used))
    srcs = {r["finding_id"]: r["sources"] for r in rows}
    for c in kept["claims"]:
        c["sources"] = list(dict.fromkeys(s for i in c["finding_ids"] for s in srcs.get(i, [])))
    cited = {n for i in used for n in findings[i]["cites"]}

    def entity(eid, what):
        if not eid:
            return None
        if eid not in cited:
            dropped.append({"kind": what, "id": eid, "reason": "not cited by a kept finding"})
            return None
        b = run(ctx.graph, "node_brief", id=eid)[0]
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
    "1. Call recall_memory first. Always dispatch store_ops and growth in the first round. If memory returns a "
    "plan learned from similar past incidents, add its departments to that first round and pass the memory's hint in the instruction. A memory is a hint "
    "about where to look first, not evidence: confirm it with this investigation's Findings.\n"
    "2. Dispatch several departments in the same turn when their work is independent; they run in parallel.\n"
    "3. When one department's Finding opens work for another (for example Store Ops finds a decision caused by "
    "broken equipment), dispatch that department next with the specific ids. At most 6 tasks in total.\n"
    "4. Use connect_path to check whether entities from different departments' Findings are actually linked "
    "(for example a campaign and a broken unit in the same store), and rank_people to see who is most connected "
    "to the incident.\n"
    "5. Finish with submit_answer. Every claim and action must list the Finding refs (F1, F2, ...) that support it; claims "
    "without valid Finding ids are dropped. root_cause_id and amplifier_id must be node ids that a cited "
    "Finding mentions. The root cause is what started the problem; an amplifier made it worse. Use null when "
    "there is none. Recommend concrete actions with the owner to contact.",
    [ToolSpec("recall_memory", "Past incidents similar to this alert and the plan learned for the pattern.", {},
              _recall),
     ToolSpec("dispatch", "Give one department a task. Returns its report and the Findings it wrote.",
              {"department": {"type": "string", "enum": list(DEPARTMENTS)}, "instruction": STR}, _dispatch,
              parallel=True),
     T_READ, T_PATH, T_RANK,
     ToolSpec("submit_answer", "Submit the final answer. Ends the investigation.",
              {"summary": STR, "root_cause_id": NSTR, "amplifier_id": NSTR, "claims": CLAIM, "actions": CLAIM},
              _submit)])

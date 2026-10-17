import { useCallback, useEffect, useRef, useState } from "react";
import { loadReplay, streamLive } from "../events.js";

export const TENANT = "dashmart";
const STEP_MS = 500; // pace of the animation, one event per tick
export const edgeKey = (from, type, to) => `${from}|${type}|${to}`;

const EMPTY = {
  investigationId: null,
  model: null,
  steps: [], // timeline: memory, tasks and tool calls in arrival order
  findings: [],
  thinking: [], // agents with a model call in flight
  answer: null,
  memories: [],
  done: false,
  failed: null,
};

// Investigation state, driven only by events (docs/events.md). Live and replay feed the same queue.
export function useInvestigation() {
  const queue = useRef([]);
  const touchedNodes = useRef(new Map()); // id -> step
  const touchedEdges = useRef(new Map()); // edgeKey -> step
  const stepNodes = useRef(new Map()); // step -> node ids
  const [run, setRun] = useState(EMPTY);
  const [active, setActive] = useState(null); // {alertId, mode}
  const [notice, setNotice] = useState(null);

  const apply = useCallback((ev) => {
    const d = ev.data || {};
    switch (ev.type) {
      case "investigation_started":
        touchedNodes.current = new Map();
        touchedEdges.current = new Map();
        stepNodes.current = new Map();
        setRun({ ...EMPTY, investigationId: ev.investigation_id, model: d.model || null });
        return;
      case "memory_recalled":
        setRun((r) => ({ ...r, steps: [...r.steps, {
          kind: "memory", key: `m${r.steps.length}`,
          text: d.plan ? `${d.memories.length} similar incident(s) recalled` : "No similar incident yet",
          detail: d.plan ? `Suggested plan: ${d.plan.departments.join(", ")}` : "Starting from the alert alone.",
        }] }));
        return;
      case "task_created":
        setRun((r) => ({ ...r, steps: [...r.steps, {
          kind: "task", key: d.task_id, taskId: d.task_id, agent: d.department, round: d.round, text: d.instruction, status: "open",
        }] }));
        return;
      case "task_completed":
        setRun((r) => ({ ...r, steps: r.steps.map((s) => (s.taskId === d.task_id
          ? { ...s, status: d.status || "done", report: d.report, unverified: d.unverified_refs || [] } : s)) }));
        return;
      case "model_started":
        setRun((r) => ({ ...r, thinking: [...r.thinking, d.agent] }));
        return;
      case "model_turn":
        setRun((r) => {
          const i = r.thinking.indexOf(d.agent);
          return i < 0 ? r : { ...r, thinking: r.thinking.filter((_, j) => j !== i) };
        });
        return;
      case "tool_call":
        setRun((r) => ({ ...r, steps: [...r.steps, {
          kind: "tool", key: d.step, step: d.step, agent: d.agent, tool: d.tool, args: d.args || {}, nodes: 0, edges: 0,
        }] }));
        return;
      case "nodes_touched":
        stepNodes.current.set(d.step, d.node_ids);
        d.node_ids.forEach((id) => touchedNodes.current.has(id) || touchedNodes.current.set(id, d.step));
        setRun((r) => ({ ...r, steps: r.steps.map((s) => (s.step === d.step ? { ...s, nodes: d.node_ids.length } : s)) }));
        return;
      case "edges_touched":
        d.edges.forEach((e) => {
          const k = edgeKey(e.from, e.type, e.to);
          if (!touchedEdges.current.has(k)) touchedEdges.current.set(k, d.step);
        });
        setRun((r) => ({ ...r, steps: r.steps.map((s) => (s.step === d.step ? { ...s, edges: d.edges.length } : s)) }));
        return;
      case "finding_written":
        setRun((r) => ({ ...r, findings: [...r.findings, d] }));
        return;
      case "answer_ready":
        setRun((r) => ({ ...r, answer: { ...d.answer, dropped: d.dropped || [] }, thinking: [], done: true }));
        return;
      case "memory_written":
        setRun((r) => ({ ...r, memories: [...r.memories, d] }));
        return;
      case "error":
        setRun((r) => ({ ...r, failed: d.message, thinking: [] }));
        setNotice(`Investigation failed: ${d.message}`);
        return;
      default:
    }
  }, []);

  // drain the event queue at a pace people can follow
  useEffect(() => {
    const t = setInterval(() => {
      const ev = queue.current.shift();
      if (ev) apply(ev);
    }, STEP_MS);
    return () => clearInterval(t);
  }, [apply]);

  const closeLive = useRef(null);
  useEffect(() => () => closeLive.current?.(), []);

  const start = useCallback((alertId, mode, backend) => {
    closeLive.current?.();
    closeLive.current = null;
    queue.current = [];
    touchedNodes.current = new Map();
    touchedEdges.current = new Map();
    stepNodes.current = new Map();
    setRun(EMPTY);
    setNotice(null);
    setActive({ alertId, mode });
    if (mode === "live") {
      closeLive.current = streamLive(alertId, TENANT, (ev) => queue.current.push(ev), () =>
        setNotice("Live investigation failed to connect. Check the backend, pick another model, or use the recorded replay."), backend);
    } else {
      loadReplay(alertId)
        .then((evs) => queue.current.push(...evs))
        .catch((e) => setNotice(String(e.message || e)));
    }
  }, []);

  return { run, active, notice, setNotice, start, touchedNodes, touchedEdges, stepNodes };
}

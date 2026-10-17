// Event sources for an investigation. Both produce the same events (docs/events.md).
export const EVENT_TYPES = [
  "investigation_started", "memory_recalled", "task_created", "model_started", "model_turn", "tool_call",
  "nodes_touched", "edges_touched", "finding_written", "task_completed", "answer_ready", "memory_written",
  "node_created", "error",
];

// Live: server-sent events from the backend. Returns a function that closes the stream.
// `backend` picks the model backend (claude, local, scripted); omit it for the server default.
export function streamLive(alertId, tenant, onEvent, onFail, backend) {
  const q = new URLSearchParams({ tenant });
  if (backend) q.set("backend", backend);
  const es = new EventSource(`/api/investigate/${encodeURIComponent(alertId)}?${q}`);
  let got = 0;
  for (const t of EVENT_TYPES) {
    es.addEventListener(t, (msg) => {
      if (msg.data === undefined) return; // the browser's own "error" when the stream closes, not a backend event
      got++;
      const ev = JSON.parse(msg.data);
      onEvent(ev);
      if (t === "error") es.close();
    });
  }
  es.onerror = () => {
    es.close();
    if (!got) onFail();
  };
  return () => es.close();
}

// Replay: a recorded event log saved by investigate_cli.py --events.
export async function loadReplay(alertId) {
  const res = await fetch(`/runs/${alertId}.json`);
  if (!res.ok) throw new Error(`no recorded run for ${alertId}`);
  return res.json();
}

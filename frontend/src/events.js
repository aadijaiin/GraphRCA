// Event sources for an investigation. Both produce the same events (docs/events.md).
export const EVENT_TYPES = [
  "investigation_started", "tool_call", "nodes_touched", "edges_touched",
  "finding_written", "answer_ready", "memory_written", "node_created", "error",
];

// Live: server-sent events from the backend. Returns a function that closes the stream.
export function streamLive(alertId, tenant, onEvent, onFail) {
  const es = new EventSource(`/api/investigate/${encodeURIComponent(alertId)}?tenant=${tenant}`);
  let got = 0;
  for (const t of EVENT_TYPES) {
    es.addEventListener(t, (msg) => {
      got++;
      const ev = JSON.parse(msg.data);
      onEvent(ev);
      if (t === "answer_ready" || t === "error") es.close();
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

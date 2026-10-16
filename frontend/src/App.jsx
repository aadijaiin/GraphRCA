import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { LABEL_COLORS, NODE_SIZE } from "./colors.js";
import { loadReplay, streamLive } from "./events.js";

const TENANT = "dashmart";
const STEP_MS = 500; // pace of the animation, one event per tick
const edgeKey = (from, type, to) => `${from}|${type}|${to}`;

// dispatch takes a list of tasks; show the departments, not [object Object]
const formatArgs = (args) =>
  Object.values(args)
    .filter((v) => v !== null)
    .map((v) => (Array.isArray(v) ? v.map((t) => t?.department ?? JSON.stringify(t)).join(" + ") : String(v)))
    .join(", ");

export default function App() {
  const fgRef = useRef();
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [alerts, setAlerts] = useState([]);
  const [loadError, setLoadError] = useState(null);

  // investigation state, driven only by events
  const queue = useRef([]);
  const touchedNodes = useRef(new Map()); // id -> step
  const touchedEdges = useRef(new Set());
  const [, setTick] = useState(0);
  const [active, setActive] = useState(null); // {alertId, mode}
  const [steps, setSteps] = useState([]); // timeline: memory, tasks and tool calls in arrival order
  const [answer, setAnswer] = useState(null);
  const [model, setModel] = useState(null);
  const [findings, setFindings] = useState(0);
  const [memories, setMemories] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    Promise.all([fetch(`/api/graph?tenant=${TENANT}`), fetch(`/api/alerts?tenant=${TENANT}`)])
      .then(async ([g, a]) => {
        if (!g.ok || !a.ok) throw new Error("backend unavailable");
        const data = await g.json();
        data.links.forEach((l) => (l.key = edgeKey(l.source, l.type, l.target)));
        setGraph(data);
        setAlerts(await a.json());
        // fit once the layout has settled and the canvas has its final size
        [300, 1200].forEach((ms) => setTimeout(() => fgRef.current?.zoomToFit(400, 40), ms));
      })
      .catch((e) => setLoadError(String(e.message || e)));
  }, []);

  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  const apply = useCallback((ev) => {
    const d = ev.data || {};
    switch (ev.type) {
      case "investigation_started":
        touchedNodes.current = new Map();
        touchedEdges.current = new Set();
        setSteps([]);
        setAnswer(null);
        setFindings(0);
        setMemories([]);
        setModel(d.model || null);
        break;
      case "memory_recalled":
        setSteps((s) => [...s, { kind: "memory", key: `m${s.length}`, text: d.plan
          ? `Memory: ${d.memories.length} similar incident(s); plan ${d.plan.departments.join(", ")}`
          : "Memory: no similar incident yet" }]);
        break;
      case "task_created":
        setSteps((s) => [...s, { kind: "task", key: d.task_id, agent: d.department, round: d.round, text: d.instruction }]);
        break;
      case "tool_call":
        setSteps((s) => [...s, { kind: "tool", key: d.step, step: d.step, agent: d.agent, tool: d.tool, args: d.args, nodes: 0, edges: 0 }]);
        break;
      case "finding_written":
        setFindings((n) => n + 1);
        break;
      case "memory_written":
        setMemories((m) => [...m, d]);
        break;
      case "nodes_touched":
        d.node_ids.forEach((id) => touchedNodes.current.has(id) || touchedNodes.current.set(id, d.step));
        setSteps((s) => s.map((x) => (x.step === d.step ? { ...x, nodes: d.node_ids.length } : x)));
        break;
      case "edges_touched":
        d.edges.forEach((e) => touchedEdges.current.add(edgeKey(e.from, e.type, e.to)));
        setSteps((s) => s.map((x) => (x.step === d.step ? { ...x, edges: d.edges.length } : x)));
        break;
      case "answer_ready":
        setAnswer(d.answer);
        break;
      case "error":
        setNotice(`Investigation failed: ${d.message}`);
        break;
      default:
        break;
    }
    setTick((t) => t + 1);
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
  const start = (alertId, mode) => {
    closeLive.current?.();
    queue.current = [];
    setNotice(null);
    setDrawer(null);
    setActive({ alertId, mode });
    if (mode === "live") {
      closeLive.current = streamLive(alertId, TENANT, (ev) => queue.current.push(ev), () =>
        setNotice("Live investigation failed to connect. Use the recorded replay instead."));
    } else {
      loadReplay(alertId)
        .then((evs) => queue.current.push(...evs))
        .catch((e) => setNotice(String(e.message || e)));
    }
  };

  // deep link for demos: ?alert=ALT-001&mode=replay
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (graph.nodes.length && p.get("alert") && !active) start(p.get("alert"), p.get("mode") === "replay" ? "replay" : "live");
  }, [graph]); // eslint-disable-line react-hooks/exhaustive-deps

  const openSources = async (ids, title) => {
    const res = await fetch(`/api/artifacts?tenant=${TENANT}&ids=${ids.join(",")}`);
    setDrawer({ title, artifacts: await res.json() });
  };

  const onNodeClick = (n) => {
    if (n.label === "Artifact") openSources([n.id], n.id);
    else setDrawer({ title: `${n.label} ${n.id}`, text: n.name, artifacts: [] });
  };

  const investigating = touchedNodes.current.size > 0;

  const drawNode = (n, ctx, scale) => {
    const touched = touchedNodes.current.has(n.id);
    const r = (NODE_SIZE[n.label] || 3) * (touched ? 1.6 : 1);
    ctx.globalAlpha = investigating && !touched ? 0.18 : 1;
    if (touched) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 3, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(253, 230, 138, 0.25)";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = LABEL_COLORS[n.label] || "#888";
    ctx.fill();
    if (touched && n.label !== "Artifact") {
      const fs = Math.max(10 / scale, 2.5);
      ctx.font = `${fs}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "center";
      ctx.fillText(String(n.name).slice(0, 32), n.x, n.y + r + fs + 1);
    }
    ctx.globalAlpha = 1;
  };

  // Agent hub: a UI element at the centre (not a graph node), linked only to nodes the agent queried.
  const drawHub = (ctx, scale) => {
    if (!active) return;
    ctx.save();
    ctx.setLineDash([2 / scale, 3 / scale]);
    ctx.strokeStyle = "rgba(253, 230, 138, 0.35)";
    ctx.lineWidth = 0.6 / scale;
    for (const id of touchedNodes.current.keys()) {
      const n = nodeById.get(id);
      if (n?.x === undefined) continue;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(n.x, n.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, 2 * Math.PI);
    ctx.fillStyle = "#0f172a";
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.font = `bold ${Math.max(9 / scale, 3)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "#fde68a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("AGENT", 0, 0);
    ctx.restore();
  };

  return (
    <div className="app">
      <header>
        <h1>DashMart Brain</h1>
        <span className="sub">Cross-team incident investigator on FalkorDB</span>
        <span className="tenant">tenant: {TENANT}</span>
        {active && <span className={`mode ${active.mode}`}>{active.mode === "replay" ? "REPLAY" : "LIVE"}</span>}
        {model && <span className="model" title="Which backend chose the tool calls">backend: {model}</span>}
      </header>

      <aside className="alerts">
        <h2>Alerts</h2>
        {loadError && <p className="error">Cannot reach the backend: {loadError}</p>}
        {alerts.map((a) => (
          <div key={a.id} className={`alert ${active?.alertId === a.id ? "selected" : ""}`}>
            <button className="alert-main" onClick={() => start(a.id, "live")}>
              <strong>{a.store_id}</strong> promise time {a.before} → {a.after} min
              <small>{a.sku_name} · {a.ts.replace("T", " ").replace("Z", " UTC")}</small>
            </button>
            {a.id === "ALT-001" && (
              <button className="replay" onClick={() => start(a.id, "replay")} title="Recorded run (labelled replay)">
                replay
              </button>
            )}
          </div>
        ))}
      </aside>

      <main className="canvas">
        <ForceGraph2D
          ref={fgRef}
          graphData={graph}
          backgroundColor="#0b1020"
          nodeId="id"
          nodeLabel={(n) => `${n.label} ${n.id}: ${n.name}`}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={(n, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(n.x, n.y, (NODE_SIZE[n.label] || 3) + 2, 0, 2 * Math.PI);
            ctx.fill();
          }}
          linkColor={(l) => (touchedEdges.current.has(l.key) ? "#fde68a" : investigating ? "rgba(148,163,184,0.05)" : "rgba(148,163,184,0.18)")}
          linkWidth={(l) => (touchedEdges.current.has(l.key) ? 2 : 0.4)}
          linkDirectionalParticles={(l) => (touchedEdges.current.has(l.key) ? 2 : 0)}
          linkDirectionalParticleWidth={2.5}
          linkDirectionalParticleColor={() => "#fde68a"}
          onRenderFramePost={drawHub}
          onNodeClick={onNodeClick}
          warmupTicks={200}
          cooldownTicks={60}
          onEngineStop={() => fgRef.current?.zoomToFit(400, 40)}
        />
        <div className="legend">
          {Object.entries(LABEL_COLORS).slice(0, 10).map(([k, c]) => (
            <span key={k}><i style={{ background: c }} />{k}</span>
          ))}
        </div>
        {notice && <div className="notice">{notice}</div>}
      </main>

      <section className="panel">
        <h2>Investigation {findings > 0 && <span className="count">{findings} findings</span>}</h2>
        {!steps.length && <p className="muted">Click an alert to start an investigation.</p>}
        <ol className="steps">
          {steps.map((s) =>
            s.kind === "tool" ? (
              <li key={s.key} className="tool">
                <span className={`agent a-${s.agent}`}>{s.agent}</span>
                <code>{s.tool}</code>
                <span className="args">{formatArgs(s.args)}</span>
                <span className="size">{s.nodes} nodes · {s.edges} edges</span>
              </li>
            ) : s.kind === "task" ? (
              <li key={s.key} className="task">
                <span className="round">round {s.round}</span> → <span className={`agent a-${s.agent}`}>{s.agent}</span>
                <span className="instr">{s.text}</span>
              </li>
            ) : (
              <li key={s.key} className="memory">{s.text}</li>
            )
          )}
        </ol>

        {answer && (
          <>
            <h2>Answer</h2>
            <p className="summary">{answer.summary}</p>
            <ul className="claims">
              {answer.claims.map((c, i) => (
                <li key={i}>
                  {c.text}{" "}
                  {c.sources?.length > 0 && (
                    <button className="cite" onClick={() => openSources(c.sources, `Sources for claim ${i + 1}`)}>
                      {c.sources.length} source{c.sources.length > 1 ? "s" : ""}
                    </button>
                  )}
                  <span className="steps-ref">{c.finding_ids.length} finding{c.finding_ids.length > 1 ? "s" : ""}</span>
                </li>
              ))}
            </ul>
            {answer.actions.length > 0 && (
              <>
                <h3>Recommended actions</h3>
                <ul className="actions">
                  {answer.actions.map((a, i) => <li key={i}>{a.text}</li>)}
                </ul>
              </>
            )}
          </>
        )}

        {memories.length > 0 && (
          <>
            <h3>Remembered for next time</h3>
            <ul className="memories">
              {memories.map((m) => <li key={m.memory_id}><span className="mkind">{m.kind}</span> {m.content}</li>)}
            </ul>
          </>
        )}
      </section>

      {drawer && (
        <div className="drawer">
          <button className="close" onClick={() => setDrawer(null)}>×</button>
          <h3>{drawer.title}</h3>
          {drawer.text && <p>{drawer.text}</p>}
          {drawer.artifacts.map((a) => (
            <blockquote key={a.id}>
              <p>“{a.text}”</p>
              <footer>{a.author_name} · {a.kind} · {a.source_ref} · {a.ts}</footer>
            </blockquote>
          ))}
        </div>
      )}

      <footer className="foot">
        Synthetic data. DashMart is a fictional company and all people, messages and tickets are invented.
        The agent hub is a UI element, not a graph node.
      </footer>
    </div>
  );
}

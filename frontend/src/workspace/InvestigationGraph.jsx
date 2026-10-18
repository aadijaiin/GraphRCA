import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Eye, Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';
import { LABEL_COLORS, LEGEND, NODE_SIZE } from '../colors.js';
import { edgeKey } from './useInvestigation.js';

const idOf = (v) => (typeof v === 'object' ? v?.id : v);

// Obsidian-style palette for the dark canvas
const BG = '#1e1e1e';
const EDGE = 'rgba(255, 255, 255, 0.07)';
const LABEL = 'rgba(220, 221, 222, 0.85)';
const ACCENT = '#a882ff'; // hover / brain
const BEAM = '#ffd27a'; // light travelling along a queried edge
const GLOW = 'rgba(255, 196, 92, 0.9)'; // edges that have been queried keep glowing
const DEPT = { store_ops: '#c084fc', growth: '#f472b6', facilities: '#fbbf24', supply: '#2dd4bf' };
const DEPT_NAME = { store_ops: 'Store Ops', growth: 'Growth', facilities: 'Facilities', supply: 'Supply' };
const BRAIN = '@orchestrator';
const brainId = (agent) => (agent === 'orchestrator' ? BRAIN : `@${agent}`);

// The company graph from FalkorDB, with the agents drawn as a brain on top of it: the orchestrator links only to the
// department sub-brains it dispatched, each department links only to the data it queried, and dashed links between
// departments show that one built on another's findings. Brain nodes are UI elements, not graph nodes.
export default function InvestigationGraph({
  graph, steps = [], touchedNodes, touchedEdges, stepNodes, focusStep, active, running, selectedId, onNodeClick, version,
}) {
  const fgRef = useRef(null);
  const hostRef = useRef(null);
  const [size, setSize] = useState({ width: 740, height: 500 });
  const [filter, setFilter] = useState('all');
  const [showLegend, setShowLegend] = useState(false);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const update = () => {
      const r = host.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ width: Math.round(r.width), height: Math.round(r.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const touchedCount = touchedNodes.current.size;
  const investigating = touchedCount > 0;

  // brain overlay derived from the timeline: who was dispatched, what each agent touched, who built on whom
  const brain = useMemo(() => {
    if (!active) return { nodes: [], links: [] };
    const nodes = [{ id: BRAIN, label: 'Brain', name: 'Orchestrator', virtual: true, agent: 'orchestrator' }];
    const links = [];
    const seen = new Set();
    const add = (source, target, kind) => {
      const key = `${source}|${kind}|${target}`;
      if (!seen.has(key)) { seen.add(key); links.push({ source, target, kind, key, virtual: true }); }
    };
    const rounds = {};
    for (const s of steps) {
      if (s.kind === 'task') {
        if (!nodes.some((n) => n.id === brainId(s.agent))) {
          nodes.push({ id: brainId(s.agent), label: 'Brain', name: DEPT_NAME[s.agent] || s.agent, virtual: true, agent: s.agent });
        }
        add(BRAIN, brainId(s.agent), 'dispatch');
        rounds[s.agent] = Math.min(rounds[s.agent] ?? 99, s.round);
      }
    }
    // interdependency: a later round builds on earlier departments' findings; read_findings reads them directly
    for (const [later, rl] of Object.entries(rounds)) {
      for (const [earlier, re] of Object.entries(rounds)) if (re < rl) add(brainId(earlier), brainId(later), 'depends');
    }
    for (const s of steps) {
      if (s.kind !== 'tool') continue;
      const from = brainId(s.agent);
      if (!nodes.some((n) => n.id === from)) continue;
      if (s.tool === 'read_findings') {
        for (const other of Object.keys(rounds)) if (brainId(other) !== from) add(brainId(other), from, 'depends');
        continue;
      }
      for (const id of stepNodes.current.get(s.step) || []) add(from, id, `query:${s.step}`);
    }
    return { nodes, links };
  }, [active, steps, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => {
    const keep = filter === 'traced' && investigating ? new Set(touchedNodes.current.keys()) : null;
    const nodes = keep ? graph.nodes.filter((n) => keep.has(n.id)) : graph.nodes;
    const ids = new Set(nodes.map((n) => n.id));
    const links = graph.links.filter((l) => ids.has(idOf(l.source)) && ids.has(idOf(l.target)));
    const blinks = brain.links.filter((l) => (idOf(l.source).startsWith('@') || ids.has(idOf(l.source)))
      && (idOf(l.target).startsWith('@') || ids.has(idOf(l.target))));
    return { nodes: [...nodes, ...brain.nodes], links: [...links, ...blinks] };
  }, [graph, brain, filter, investigating, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const fit = useCallback((ms = 500) => {
    const fg = fgRef.current;
    if (!fg) return;
    if (investigating) fg.zoomToFit(ms, 60, (n) => n.virtual || touchedNodes.current.has(n.id));
    else fg.zoomToFit(ms, 40);
  }, [investigating, touchedNodes]);

  useEffect(() => {
    const fg = fgRef.current;
    fg?.d3Force('charge')?.strength((n) => (n.virtual ? -260 : -32));
    fg?.d3Force('link')?.distance((l) => (l.kind === 'dispatch' ? 70 : l.kind === 'depends' ? 90 : l.virtual ? 55 : 24));
  }, [graph, brain]);

  useEffect(() => {
    if (!touchedCount) return undefined;
    const t = setTimeout(() => fit(600), 160);
    return () => clearTimeout(t);
  }, [touchedCount, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!active) setFilter('all'); }, [active]);

  // beams: every edge the agents touch for the first time gets a light pulse; edges touched by the same step
  // (and steps of departments running in parallel) fire together, so parallel calls show as parallel beams
  const fired = useRef(new Set());
  useEffect(() => {
    if (!active) { fired.current = new Set(); return; }
    const fg = fgRef.current;
    if (!fg) return;
    for (const l of data.links) {
      const k = l.key;
      const isNew = !fired.current.has(k) && (l.virtual ? (l.kind !== 'depends') : touchedEdges.current.has(k));
      if (!isNew) continue;
      fired.current.add(k);
      fg.emitParticle(l);
      if (l.kind === 'dispatch') setTimeout(() => fg.emitParticle(l), 260);
    }
  }, [data, version, active, touchedEdges]);

  const focusSet = useMemo(() => new Set(focusStep ? stepNodes.current.get(focusStep) || [] : []), [focusStep, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const neighbours = useMemo(() => {
    if (!hovered) return null;
    const s = new Set([hovered]);
    for (const l of data.links) {
      const a = idOf(l.source); const b = idOf(l.target);
      if (a === hovered) s.add(b);
      if (b === hovered) s.add(a);
    }
    return s;
  }, [hovered, data]);

  const paintNode = useCallback((n, ctx, scale) => {
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) return;
    if (n.virtual) {
      const r = (n.id === BRAIN ? 9 : 6.5);
      const color = n.id === BRAIN ? ACCENT : DEPT[n.agent] || ACCENT;
      const g = ctx.createRadialGradient(n.x, n.y, r * 0.4, n.x, n.y, r * 2.6);
      g.addColorStop(0, `${color}66`);
      g.addColorStop(1, `${color}00`);
      ctx.beginPath(); ctx.arc(n.x, n.y, r * 2.6, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      ctx.lineWidth = 1.2 / scale; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
      const fs = Math.max(11 / scale, 3);
      ctx.font = `600 ${fs}px "Geist", system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(n.name, n.x, n.y + r + 2);
      return;
    }
    const touched = touchedNodes.current.has(n.id);
    const focused = focusSet.has(n.id);
    const selected = selectedId === n.id;
    const near = neighbours?.has(n.id);
    const r = (NODE_SIZE[n.label] || 3) * 0.75 * (focused || selected ? 1.8 : touched ? 1.4 : 1);
    const faded = (neighbours && !near) || (focusSet.size ? !focused : investigating && !touched);
    ctx.globalAlpha = faded ? (neighbours ? 0.12 : 0.28) : 1;
    if ((touched || focused) && !faded) {
      ctx.beginPath(); ctx.arc(n.x, n.y, r + 3.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 196, 92, 0.18)'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = near && hovered === n.id ? ACCENT : touched || focused || selected ? (LABEL_COLORS[n.label] || '#bbb') : '#8a8a8a';
    ctx.fill();
    if (selected || focused) { ctx.lineWidth = 1 / scale; ctx.strokeStyle = BEAM; ctx.stroke(); }
    // Obsidian shows labels on hover, for neighbours, and once you zoom in
    if (n.label !== 'Artifact' && !faded && (near || touched || focused || selected || scale > 2.2)) {
      const fs = Math.max(9 / scale, 1.7);
      ctx.font = `400 ${fs}px "Geist", system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = LABEL;
      ctx.fillText(String(n.name).slice(0, 34), n.x, n.y + r + 1.5);
    }
    ctx.globalAlpha = 1;
  }, [touchedNodes, focusSet, selectedId, neighbours, investigating, hovered]);

  const touchedLink = (l) => (l.virtual ? l.kind !== 'depends' : touchedEdges.current.has(l.key));
  const inFocus = (l) => focusStep && (l.virtual ? l.kind === `query:${focusStep}` : touchedEdges.current.get(l.key) === focusStep);
  const nearLink = (l) => hovered && (idOf(l.source) === hovered || idOf(l.target) === hovered);

  const linkColor = (l) => {
    if (nearLink(l)) return ACCENT;
    if (l.kind === 'depends') return 'rgba(168, 130, 255, 0.75)';
    if (l.virtual) return l.kind === 'dispatch' ? 'rgba(168, 130, 255, 0.6)' : `${DEPT[idOf(l.source).slice(1)] || ACCENT}55`;
    if (inFocus(l)) return BEAM;
    if (touchedLink(l)) return GLOW;
    return hovered ? 'rgba(255,255,255,0.03)' : EDGE;
  };

  // glow pass for queried edges, drawn after the line so it stays lit after the beam has passed
  const glow = useCallback((l, ctx, scale) => {
    if (l.virtual || !touchedEdges.current.has(l.key)) return;
    const s = l.source; const t = l.target;
    if (!Number.isFinite(s.x) || !Number.isFinite(t.x)) return;
    ctx.save();
    ctx.shadowColor = GLOW; ctx.shadowBlur = 8;
    ctx.strokeStyle = inFocus(l) ? BEAM : 'rgba(255, 196, 92, 0.55)';
    ctx.lineWidth = (inFocus(l) ? 2.2 : 1.3) / Math.max(scale * 0.6, 0.6);
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke();
    ctx.restore();
  }, [touchedEdges, focusStep]); // eslint-disable-line react-hooks/exhaustive-deps

  const legend = LEGEND.filter((k) => graph.nodes.some((n) => n.label === k));

  return <section className="panel graph-panel obsidian">
    <div className="graph-head">
      <div className="graph-title-group">
        <div className="panel-eyebrow">LIVE TOPOLOGY · FALKORDB</div>
        <h2>Company graph <span className={`graph-live-pill ${running ? 'motion-tracing' : ''}`}><span /> {running ? 'TRACING' : investigating ? 'SETTLED' : 'IDLE'}</span></h2>
      </div>
      <div className="graph-head-actions">
        <div className="graph-filter" role="group" aria-label="Graph filter">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All <span>{graph.nodes.length}</span></button>
          <button className={filter === 'traced' ? 'on' : ''} disabled={!investigating} onClick={() => setFilter('traced')}>Traced <span>{touchedCount}</span></button>
        </div>
        <button className={`icon-button small ${showLegend ? 'active-toggle' : ''}`} title={showLegend ? 'Hide legend' : 'Show legend'} onClick={() => setShowLegend((v) => !v)}>
          <Eye size={13} />
        </button>
        <button className="icon-button small" title="Fit graph" onClick={() => fit()}>
          <Maximize2 size={13} />
        </button>
      </div>
    </div>
    <div className="graph-canvas obsidian-canvas" ref={hostRef}>
      {showLegend && legend.length > 0 && (
        <div className="floating-legend obsidian-legend">
          <div className="floating-legend-head">
            <span>NODE LABELS</span>
            <button onClick={() => setShowLegend(false)} aria-label="Close legend">×</button>
          </div>
          <div className="floating-legend-items">
            {legend.map((k) => <span key={k}><i className="legend-shape" style={{ background: LABEL_COLORS[k] }} /> {k}</span>)}
            <span><i className="legend-shape" style={{ background: ACCENT }} /> Brain (UI)</span>
            <span><i className="legend-line dashed" /> builds on</span>
            <span><i className="legend-line beam" /> queried</span>
          </div>
        </div>
      )}
      <div className="graph-force"><ForceGraph2D
        ref={fgRef}
        width={size.width}
        height={size.height}
        graphData={data}
        backgroundColor={BG}
        autoPauseRedraw={false}
        nodeId="id"
        nodeLabel={(n) => (n.virtual ? `${n.name} (agent)` : `${n.label} ${n.id}: ${n.name}`)}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(n, color, ctx) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.virtual ? 10 : (NODE_SIZE[n.label] || 3) + 3, 0, 2 * Math.PI);
          ctx.fill();
        }}
        linkColor={linkColor}
        linkWidth={(l) => (nearLink(l) ? 1.4 : l.virtual ? (l.kind.startsWith('query') ? 0.5 : 0.9) : touchedLink(l) ? 1.2 : 0.35)}
        linkLineDash={(l) => (l.kind === 'depends' ? [4, 3] : l.virtual && l.kind.startsWith('query') ? [1, 2] : null)}
        linkCanvasObjectMode={() => 'after'}
        linkCanvasObject={glow}
        linkDirectionalParticleWidth={(l) => (l.kind === 'dispatch' ? 3.2 : 2.6)}
        linkDirectionalParticleSpeed={(l) => (l.virtual ? 0.018 : 0.012)}
        linkDirectionalParticleColor={(l) => (l.virtual && l.kind !== 'dispatch' ? DEPT[idOf(l.source).slice(1)] || BEAM : BEAM)}
        onNodeClick={(n) => { if (!n.virtual) onNodeClick(n); }}
        onNodeHover={(n) => setHovered(n?.id || null)}
        onBackgroundClick={() => setHovered(null)}
        warmupTicks={200}
        cooldownTicks={80}
        onEngineStop={() => fit(400)}
      /></div>
      <div className="graph-bottom-bar">
        <div className="graph-trace-pill">
          {running && <span className="trace-pulse" />}
          <span className="mono">TRACE:</span>
          <b>{touchedCount} nodes · {touchedEdges.current.size} edges</b>
          {active && <><span className="trace-sep">·</span><span className="trace-mode">{active.alertId} {active.mode === 'replay' ? '(replay)' : ''}</span></>}
        </div>
        <div className="graph-zoom-controls">
          <button aria-label="Zoom out" title="Zoom out" onClick={() => fgRef.current?.zoom((fgRef.current?.zoom() || 1) / 1.3, 220)}><Minus size={13} /></button>
          <button aria-label="Reset graph view" title="Fit" onClick={() => fit()}><RotateCcw size={12} /></button>
          <button aria-label="Zoom in" title="Zoom in" onClick={() => fgRef.current?.zoom((fgRef.current?.zoom() || 1) * 1.3, 220)}><Plus size={13} /></button>
        </div>
      </div>
    </div>
  </section>;
}

export { edgeKey };

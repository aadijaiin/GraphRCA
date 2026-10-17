import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Eye, Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';
import { LABEL_COLORS, LEGEND, NODE_SIZE, TRACE } from '../colors.js';
import { edgeKey } from './useInvestigation.js';

const idOf = (v) => (typeof v === 'object' ? v?.id : v);

// lighten (amt > 0) or darken (amt < 0) a #rrggbb colour
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? 255 - c : c) * amt)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function drawPill(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

// The company graph from FalkorDB. Nodes and edges an agent touched light up; everything else recedes.
export default function InvestigationGraph({
  graph, touchedNodes, touchedEdges, stepNodes, focusStep, active, running, selectedId, onNodeClick, version,
}) {
  const fgRef = useRef(null);
  const hostRef = useRef(null);
  const [size, setSize] = useState({ width: 740, height: 500 });
  const [filter, setFilter] = useState('all');
  const [showLegend, setShowLegend] = useState(true);
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

  // "Traced" shows only what the agents touched, plus the edges between those nodes
  const data = useMemo(() => {
    if (filter !== 'traced' || !investigating) return graph;
    const keep = new Set(touchedNodes.current.keys());
    return {
      nodes: graph.nodes.filter((n) => keep.has(n.id)),
      links: graph.links.filter((l) => keep.has(idOf(l.source)) && keep.has(idOf(l.target))),
    };
  }, [graph, filter, investigating, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const fit = useCallback((ms = 500) => {
    const fg = fgRef.current;
    if (!fg) return;
    if (investigating) fg.zoomToFit(ms, 60, (n) => touchedNodes.current.has(n.id));
    else fg.zoomToFit(ms, 40);
  }, [investigating, touchedNodes]);

  useEffect(() => {
    fgRef.current?.d3Force('charge')?.strength(-38);
    fgRef.current?.d3Force('link')?.distance(26);
  }, [graph]);

  // follow the investigation: re-frame on the touched subgraph as it grows, then once more when it settles
  useEffect(() => {
    if (!touchedCount) return undefined;
    const t = setTimeout(() => fit(600), 120);
    return () => clearTimeout(t);
  }, [touchedCount, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!active) setFilter('all'); }, [active]);

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
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) return; // not placed by the simulation yet
    const touched = touchedNodes.current.has(n.id);
    const focused = focusSet.has(n.id);
    const selected = selectedId === n.id;
    const near = neighbours?.has(n.id);
    const color = LABEL_COLORS[n.label] || '#8d8a80';
    const base = NODE_SIZE[n.label] || 3;
    const r = base * (focused || selected ? 1.9 : touched ? 1.55 : 1);
    const dim = (focusSet.size ? !focused : investigating ? !touched : false) && !near && !selected;

    ctx.save();
    ctx.globalAlpha = dim ? (focusSet.size && touched ? 0.45 : 0.16) : 1;

    if ((touched || focused || selected) && !dim) {
      const g = ctx.createRadialGradient(n.x, n.y, r * 0.6, n.x, n.y, r + 7);
      g.addColorStop(0, 'rgba(232, 98, 43, 0.28)');
      g.addColorStop(1, 'rgba(232, 98, 43, 0)');
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 7, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    }

    // sphere: lit from the top left
    const lx = n.x - r * 0.32; const ly = n.y - r * 0.32;
    const body = ctx.createRadialGradient(lx, ly, r * 0.06, n.x, n.y, r);
    body.addColorStop(0, shade(color, 0.35));
    body.addColorStop(0.45, color);
    body.addColorStop(1, shade(color, -0.25));
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = (focused || selected ? 1.2 : 0.5) / Math.max(scale, 0.6);
    ctx.strokeStyle = focused || selected ? TRACE : 'rgba(247, 246, 240, 0.9)';
    ctx.stroke();

    // labels: always for touched and focused nodes, otherwise only once zoomed in
    const showLabel = n.label !== 'Artifact' && (touched || focused || selected || near || scale > 2.6);
    if (showLabel && !(dim && !near)) {
      const fs = Math.max(9 / scale, 1.6);
      ctx.font = `400 ${fs}px "Geist Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = String(n.name).slice(0, 34);
      const w = ctx.measureText(text).width + fs;
      const y = n.y + r + fs * 1.1;
      drawPill(ctx, n.x - w / 2, y - fs * 0.75, w, fs * 1.5, fs * 0.4);
      ctx.fillStyle = touched || focused ? 'rgba(255, 255, 255, 0.96)' : 'rgba(247, 246, 240, 0.9)';
      ctx.fill();
      ctx.lineWidth = 0.5 / scale;
      ctx.strokeStyle = focused || selected ? 'rgba(232, 98, 43, 0.7)' : 'rgba(26, 22, 20, 0.14)';
      ctx.stroke();
      ctx.fillStyle = touched || focused ? '#1a1614' : '#6e6a63';
      ctx.fillText(text, n.x, y);
    }
    ctx.restore();
  }, [touchedNodes, focusSet, selectedId, neighbours, investigating]);

  const linkIsTouched = (l) => touchedEdges.current.has(l.key);
  const linkInFocus = (l) => focusStep && touchedEdges.current.get(l.key) === focusStep;

  // Agent hub: a UI element at the centre (not a graph node), linked only to nodes the agent queried.
  const drawHub = useCallback((ctx, scale) => {
    if (!active || !investigating) return;
    const nodes = data.nodes.filter((n) => touchedNodes.current.has(n.id) && n.x !== undefined);
    if (!nodes.length) return;
    const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
    const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
    ctx.save();
    ctx.setLineDash([2 / scale, 3 / scale]);
    ctx.strokeStyle = 'rgba(232, 98, 43, 0.3)';
    ctx.lineWidth = 0.6 / scale;
    for (const n of nodes) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(n.x, n.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const r = 11 / Math.max(scale, 0.8);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a1614';
    ctx.fill();
    ctx.lineWidth = 1.5 / scale;
    ctx.strokeStyle = TRACE;
    ctx.stroke();
    ctx.font = `500 ${r * 0.62}px "Geist Mono", ui-monospace, monospace`;
    ctx.fillStyle = '#f4f4e7';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AGENT', cx, cy);
    ctx.restore();
  }, [active, investigating, data, touchedNodes]);

  const legend = LEGEND.filter((k) => graph.nodes.some((n) => n.label === k));

  return <section className="panel graph-panel">
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
    <div className="graph-canvas" ref={hostRef}>
      <div className="graph-grid" />
      {showLegend && legend.length > 0 && (
        <div className="floating-legend">
          <div className="floating-legend-head">
            <span>NODE LABELS</span>
            <button onClick={() => setShowLegend(false)} aria-label="Close legend">×</button>
          </div>
          <div className="floating-legend-items">
            {legend.map((k) => <span key={k}><i className="legend-shape" style={{ background: LABEL_COLORS[k] }} /> {k}</span>)}
          </div>
        </div>
      )}
      <div className="graph-force"><ForceGraph2D
        ref={fgRef}
        width={size.width}
        height={size.height}
        graphData={data}
        backgroundColor="rgba(0,0,0,0)"
        autoPauseRedraw={false}
        nodeId="id"
        nodeLabel={(n) => `${n.label} ${n.id}: ${n.name}`}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(n, color, ctx) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, (NODE_SIZE[n.label] || 3) + 3, 0, 2 * Math.PI);
          ctx.fill();
        }}
        linkColor={(l) => (linkInFocus(l) ? TRACE : linkIsTouched(l) ? (focusStep ? 'rgba(232, 98, 43, 0.35)' : 'rgba(232, 98, 43, 0.85)') : investigating ? 'rgba(26, 22, 20, 0.05)' : 'rgba(26, 22, 20, 0.14)')}
        linkWidth={(l) => (linkInFocus(l) ? 2.6 : linkIsTouched(l) ? 1.8 : 0.4)}
        linkDirectionalParticles={(l) => (linkIsTouched(l) ? 2 : 0)}
        linkDirectionalParticleWidth={2.4}
        linkDirectionalParticleColor={() => TRACE}
        onRenderFramePost={drawHub}
        onNodeClick={onNodeClick}
        onNodeHover={(n) => setHovered(n?.id || null)}
        onBackgroundClick={() => setHovered(null)}
        warmupTicks={200}
        cooldownTicks={80}
        onEngineStop={() => { if (!investigating) fit(400); }}
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

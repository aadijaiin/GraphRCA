import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, BrainCircuit, Check, ChevronDown, CircleAlert, Clock3, Cpu, FileText,
  History, ListTree, Network, Play, Quote, RotateCcw, ShieldCheck, Sparkles, Users, Wrench, X,
} from 'lucide-react';
import InvestigationGraph from './InvestigationGraph.jsx';
import { TENANT, edgeKey, useInvestigation } from './useInvestigation.js';

const REPLAYS = new Set(['ALT-001']); // alerts with a recorded run under public/runs/
// Fallback if the API cannot be asked; normally the list comes from /api/backends (labels name the real model).
const DEFAULT_MODELS = [
  { id: 'local', label: 'Server · gpt-oss-20b', available: true },
  { id: 'scripted', label: 'Scripted (no model)', available: true },
];
const BACKEND_KEY = 'blinkbrain.backend';
const savedBackend = () => { try { return localStorage.getItem(BACKEND_KEY) || ''; } catch { return ''; } };

const pretty = (agent) => String(agent || '').split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const when = (ts) => (ts ? ts.replace('T', ' ').replace(/:00Z$|Z$/, '') + ' UTC' : '');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// dispatch takes a list of tasks; show the departments, not [object Object]
const formatArgs = (args) =>
  Object.values(args)
    .filter((v) => v !== null)
    .map((v) => (Array.isArray(v) ? v.map((t) => t?.department ?? JSON.stringify(t)).join(' + ') : String(v)))
    .join(', ');

export function BrandGlyph() {
  // BlinkBrain mark: a 3×3 dot lattice with one lit node
  const dots = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
  return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    {dots.map(([x, y]) => (
      <circle key={`${x}${y}`} cx={3 + x * 6} cy={3 + y * 6} r={x === 1 && y === 1 ? 2.4 : 1.6} className={x === 1 && y === 1 ? 'glyph-hot' : 'glyph-dot'} />
    ))}
  </svg>;
}

function AppRail({ onBackHome }) {
  const items = [
    { icon: Activity, label: 'Alerts', target: 'ws-alerts' },
    { icon: Network, label: 'Company graph', target: 'ws-graph' },
    { icon: ListTree, label: 'Investigation', target: 'ws-investigation' },
    { icon: History, label: 'Memory', target: 'ws-memory' },
  ];
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return <nav className="app-rail" aria-label="Workspace navigation">
    <button type="button" className="rail-brand" onClick={onBackHome} aria-label="Back to BlinkBrain overview" title="Back to overview">
      <BrandGlyph />
    </button>
    <div className="rail-items">
      {items.map(({ icon: I, label, target }) => (
        <button key={label} type="button" className="rail-item" aria-label={label} title={label} onClick={() => go(target)}>
          <I size={15} strokeWidth={1.7} />
        </button>
      ))}
    </div>
  </nav>;
}

function Header({ onBackHome, online, active, model, backend, setBackend, models }) {
  return <header className="topbar">
    <div className="topbar-crumbs">
      <button type="button" className="topbar-home-pill" onClick={onBackHome}>← Overview</button>
      <span className="crumb-sep">/</span>
      <span className="crumb">BLINKBRAIN</span>
      <span className="crumb-sep">·</span>
      <span className="crumb crumb-strong">TENANT · {TENANT.toUpperCase()}</span>
    </div>
    <div className="topbar-right">
      {active && <span className={`mode-pill ${active.mode}`}>{active.mode === 'replay' ? 'REPLAY' : 'LIVE'}</span>}
      {model && <span className="backend-indicator" title="Which backend chose the tool calls"><Cpu size={11} /> {model}</span>}
      <div className="backend-indicator" title={online === false ? 'The API at /api is not reachable' : 'Connected to the FalkorDB-backed API'}>
        <span className={`status-dot ${online ? 'live' : online === false ? 'down' : ''}`} />
        <span>{online ? 'FalkorDB live' : online === false ? 'Backend offline' : 'Connecting…'}</span>
      </div>
      <label className="role-dropdown" title="Model backend for live investigations">
        <Cpu size={12} className="role-icon" />
        <select value={backend} onChange={(e) => setBackend(e.target.value)} aria-label="Model backend">
          {models.map((m) => (
            <option key={m.id} value={m.id} disabled={!m.available} title={m.hint || ''}>
              {m.label}{m.available ? '' : ' (not configured)'}
            </option>
          ))}
        </select>
        <ChevronDown size={11} className="role-chevron" />
      </label>
    </div>
  </header>;
}

function Overview({ graph, alerts, run, touched, edges }) {
  const count = (label) => graph.nodes.filter((n) => n.label === label).length;
  const departments = new Set(run.steps.filter((s) => s.kind === 'task').map((s) => s.agent));
  const worst = alerts.reduce((m, a) => Math.max(m, a.after - a.before), 0);
  return <section className="overview">
    <div className="overview-head">
      <div>
        <h1 className="overview-greeting">Incident investigations</h1>
        <p className="overview-sub">
          DashMart · {plural(count('Store'), 'dark store')} · {plural(count('Person'), 'person')} · {plural(count('Artifact'), 'message')} and tickets linked in one graph
        </p>
      </div>
      <div className="overview-period">
        <span className="period-label">TENANT</span>
        <span className="period-pill"><b>{TENANT}</b></span>
      </div>
    </div>
    <div className="kpi-grid">
      <article className="kpi-card">
        <div className="kpi-label">COMPANY GRAPH</div>
        <div className="kpi-value">{graph.nodes.length || '—'}</div>
        <div className="kpi-foot">{graph.links.length} relationships</div>
      </article>
      <article className="kpi-card">
        <div className="kpi-label">OPEN ALERTS</div>
        <div className="kpi-value">{alerts.length || '—'}</div>
        <div className="kpi-foot tone-orange">{alerts.length ? `worst +${worst.toFixed(1)} min promise time` : 'none loaded'}</div>
      </article>
      <article className="kpi-card">
        <div className="kpi-label">TRACED THIS RUN</div>
        <div className="kpi-value">{touched}</div>
        <div className="kpi-foot">{edges} edges walked</div>
      </article>
      <article className="kpi-card">
        <div className="kpi-label">FINDINGS</div>
        <div className="kpi-value">{run.findings.length}</div>
        <div className="kpi-foot tone-olive">{departments.size ? `${plural(departments.size, 'department')} dispatched` : 'no run yet'}</div>
      </article>
    </div>
  </section>;
}

function AlertCards({ alerts, active, running, start, loadError }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? alerts : alerts.slice(0, 4);
  return <section className="decisions" id="ws-alerts" aria-label="Alerts">
    <div className="section-label-row">
      <span className="section-label">ALERTS · NEWEST FIRST</span>
      {alerts.length > 4 && (
        <button type="button" className="section-label muted link-button" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'SHOW FEWER' : `VIEW ALL ${alerts.length}`}
        </button>
      )}
    </div>
    {loadError && <div className="ws-notice error"><CircleAlert size={14} /> Cannot reach the backend: {loadError}. Start it with <code>docker compose up</code> or <code>uvicorn app:app</code>; the recorded replay still works.</div>}
    {loadError && !alerts.length && (
      <div className="decision-grid">
        <article className="decision-card">
          <div className="decision-meta"><span className="tag tag-plain"><History size={11} /> Recorded run</span></div>
          <h3 className="decision-title">ALT-001 · SD-04</h3>
          <p className="decision-detail">Replay the saved investigation of the Probiotic Buttermilk promise-time alert.</p>
          <div className="decision-actions"><button type="button" className="btn-ink" onClick={() => start('ALT-001', 'replay')}><Play size={12} /> Replay</button></div>
        </article>
      </div>
    )}
    <div className="decision-grid">
      {shown.map((a) => {
        const delta = a.after - a.before;
        const isActive = active?.alertId === a.id;
        return <article key={a.id} className={`decision-card ${isActive ? 'active' : ''}`}>
          <div className="decision-meta">
            <span className={`tag ${delta >= 6 ? 'tag-red' : 'tag-orange'}`}><AlertTriangle size={11} /> +{delta.toFixed(1)} min</span>
            <span className="tag tag-plain">{isActive && running ? <><span className="pulse-dot" /> running</> : <><Clock3 size={11} /> {a.id}</>}</span>
          </div>
          <h3 className="decision-title">{a.store_id} · {a.sku_name}</h3>
          <p className="decision-detail">Promise time {a.before} → {a.after} min · {when(a.ts)}</p>
          <div className="decision-actions">
            <button type="button" className="btn-ink" onClick={() => start(a.id, 'live')} title="Run a live investigation against the graph">
              <Sparkles size={12} /> Investigate
            </button>
            {REPLAYS.has(a.id) && (
              <button type="button" className="btn-ghost" onClick={() => start(a.id, 'replay')} title="Recorded run (labelled replay)">
                <RotateCcw size={12} /> Replay
              </button>
            )}
          </div>
        </article>;
      })}
    </div>
  </section>;
}

function Timeline({ run, active, running, focusStep, setFocusStep }) {
  const icon = (s) => (s.kind === 'memory' ? History : s.kind === 'task' ? Users : Wrench);
  return <section className="panel xray-panel" id="ws-investigation">
    <div className="panel-header xray-header">
      <div>
        <div className="panel-eyebrow">DECISION PROVENANCE</div>
        <h2>Investigation</h2>
      </div>
      {run.findings.length > 0 && <span className="tag tag-plain">{plural(run.findings.length, 'finding')}</span>}
    </div>

    {!active && <p className="entity-empty">Pick an alert to start. Each step below is a real tool call against FalkorDB; hover one to see what it touched in the graph.</p>}

    {running && (
      <div className="thinking-row">
        <span className="pulse-dot" />
        {run.thinking.length
          ? <span>{[...new Set(run.thinking)].map(pretty).join(', ')} {run.thinking.length > 1 ? 'are' : 'is'} thinking…</span>
          : <span>{run.steps.length ? 'Working…' : 'Starting investigation…'}</span>}
      </div>
    )}

    {run.steps.length > 0 && (
      <div className="inspector-section-heading">
        <span>STEP-BY-STEP TRACE</span>
        <span className="hop-count">{run.steps.length} STEPS</span>
      </div>
    )}

    <div className="hop-list">
      {run.steps.map((s, i) => {
        const I = icon(s);
        const focused = s.kind === 'tool' && focusStep === s.step;
        const last = i === run.steps.length - 1;
        return <div
          key={s.key}
          className={`hop-row ${focused ? 'selected' : ''} ${s.kind === 'tool' ? 'hop-tool' : ''} ${s.status === 'failed' ? 'hop-denied' : ''}`}
          onMouseEnter={() => s.kind === 'tool' && setFocusStep(s.step)}
          onMouseLeave={() => setFocusStep(null)}
          onClick={() => s.kind === 'tool' && setFocusStep(focused ? null : s.step)}
        >
          <div className="hop-track">
            <span className={`hop-index ${last && running ? 'index-animating' : 'index-traversed'} ${s.status === 'failed' ? 'index-denied' : ''}`}>
              {String(i + 1).padStart(2, '0')}
            </span>
            {!last && <span className="hop-connector connector-active" />}
          </div>
          <div className="hop-content">
            <div className="hop-topline">
              <span className="hop-relation">
                {s.kind === 'memory' ? 'MEMORY' : s.kind === 'task' ? `ROUND ${s.round} · DISPATCH` : s.step}
              </span>
              {s.kind === 'tool' && <span className="hop-kind">{s.nodes} NODES · {s.edges} EDGES</span>}
              {s.kind === 'task' && (s.status === 'open'
                ? <span className="mini-status traversing"><span className="pulse-dot" /> WORKING</span>
                : s.status === 'failed'
                  ? <span className="mini-status denied">FAILED</span>
                  : <span className="mini-status traversed"><Check size={8} /> REPORTED</span>)}
            </div>
            <div className="hop-title">
              <I size={13} />
              {s.kind === 'memory' && s.text}
              {s.kind === 'task' && <span className={`agent-chip a-${s.agent}`}>{pretty(s.agent)}</span>}
              {s.kind === 'tool' && <><span className={`agent-chip a-${s.agent}`}>{pretty(s.agent)}</span><code className="tool-name">{s.tool}</code></>}
            </div>
            <div className="hop-detail">
              {s.kind === 'memory' && s.detail}
              {s.kind === 'task' && s.text}
              {s.kind === 'tool' && <span className="tool-args">{formatArgs(s.args) || 'no arguments'}</span>}
            </div>
            {s.kind === 'task' && s.unverified?.length > 0 && (
              <div className="hop-detail red-text">Report mentions unverified refs: {s.unverified.join(', ')}</div>
            )}
          </div>
        </div>;
      })}
    </div>
  </section>;
}

function AnswerDock({ answer, findings, openSources, openFindings, focusNode }) {
  return <section className="answer-dock panel" aria-live="polite">
    <div className="answer-badge"><BrainCircuit size={12} /><span>ANSWER</span></div>
    <div className="answer-text">{answer.summary}</div>
    {(answer.root_cause || answer.amplifier) && (
      <div className="answer-entities">
        {answer.root_cause && <button type="button" className="entity-chip cause" onClick={() => focusNode(answer.root_cause.id)}>
          <span>ROOT CAUSE</span>{answer.root_cause.name || answer.root_cause.id}
        </button>}
        {answer.amplifier && <button type="button" className="entity-chip amp" onClick={() => focusNode(answer.amplifier.id)}>
          <span>AMPLIFIER</span>{answer.amplifier.name || answer.amplifier.id}
        </button>}
      </div>
    )}
    <ol className="claim-list">
      {answer.claims.map((c, i) => (
        <li key={i}>
          <p>{c.text}</p>
          <div className="claim-refs">
            {c.sources?.length > 0 && (
              <button type="button" className="ref-button" onClick={() => openSources(c.sources, `Sources for claim ${i + 1}`)}>
                <Quote size={11} /> {plural(c.sources.length, 'source')}
              </button>
            )}
            <button type="button" className="ref-button plain" onClick={() => openFindings(c.finding_ids, `Findings behind claim ${i + 1}`)}>
              <FileText size={11} /> {plural(c.finding_ids.length, 'finding')}
            </button>
          </div>
        </li>
      ))}
    </ol>
    {answer.actions?.length > 0 && <>
      <div className="inspector-section-heading"><span>RECOMMENDED ACTIONS</span><span>{answer.actions.length}</span></div>
      <ul className="action-list">
        {answer.actions.map((a, i) => (
          <li key={i}>
            <Check size={12} />
            <span>{a.text}</span>
            <button type="button" className="ref-button plain" onClick={() => openFindings(a.finding_ids, `Findings behind action ${i + 1}`)}>{a.finding_ids.length}</button>
          </li>
        ))}
      </ul>
    </>}
    <div className="answer-meta">
      <span className="grounded-pill"><ShieldCheck size={12} /> {plural(findings, 'finding')} · every claim cites one</span>
      {answer.dropped?.length > 0 && (
        <span className="dropped-pill" title={answer.dropped.map((d) => `${d.kind}: ${d.reason}`).join('\n')}>
          {answer.dropped.length} removed by validator
        </span>
      )}
    </div>
  </section>;
}

function Drawer({ drawer, close }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  return <aside className="evidence-drawer" role="dialog" aria-label={drawer.title}>
    <div className="evidence-head">
      <div>
        <div className="panel-eyebrow">{drawer.eyebrow || 'EVIDENCE'}</div>
        <h3>{drawer.title}</h3>
      </div>
      <button type="button" className="icon-button small" onClick={close} aria-label="Close"><X size={13} /></button>
    </div>
    {drawer.text && <p className="evidence-text">{drawer.text}</p>}
    {drawer.loading && <p className="entity-empty">Loading…</p>}
    {drawer.findings?.map((f) => (
      <article key={f.finding_id} className="evidence-card">
        <div className="evidence-meta"><span className={`agent-chip a-${f.agent}`}>{pretty(f.agent)}</span><code>{f.tool}</code><span>{f.ref || f.finding_id}</span></div>
        <p>{f.summary}</p>
        {f.cites?.length > 0 && <div className="evidence-cites">cites {f.cites.join(', ')}</div>}
      </article>
    ))}
    {drawer.artifacts?.map((a) => (
      <blockquote key={a.id} className="evidence-card quote">
        <p>“{a.text}”</p>
        <footer>{a.author_name} · {a.kind} · {a.source_ref} · {when(a.ts)}</footer>
      </blockquote>
    ))}
  </aside>;
}

export default function Workspace({ onBackHome, autoStart }) {
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [alerts, setAlerts] = useState([]);
  const [online, setOnline] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [models, setModels] = useState(DEFAULT_MODELS);
  const [backend, setBackendState] = useState(savedBackend);
  const setBackend = (id) => {
    setBackendState(id);
    try { localStorage.setItem(BACKEND_KEY, id); } catch { /* private mode: the choice just is not remembered */ }
  };
  const [focusStep, setFocusStep] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const inv = useInvestigation();
  const { run, active, notice } = inv;

  useEffect(() => {
    Promise.all([fetch(`/api/graph?tenant=${TENANT}`), fetch(`/api/alerts?tenant=${TENANT}`)])
      .then(async ([g, a]) => {
        if (!g.ok || !a.ok) throw new Error('backend unavailable');
        const data = await g.json();
        data.links.forEach((l) => (l.key = edgeKey(l.source, l.type, l.target)));
        setGraph(data);
        setAlerts(await a.json());
        setOnline(true);
      })
      .catch((e) => { setOnline(false); setLoadError(String(e.message || e)); });
    fetch('/api/backends')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no /api/backends'))))
      .then((list) => {
        // server model first, then scripted, then anything else the server offers
        const order = { local: 0, scripted: 1 };
        const sorted = [...list].sort((a, b) => (order[a.id] ?? 2) - (order[b.id] ?? 2));
        setModels(sorted);
        setBackendState((cur) => (sorted.some((m) => m.id === cur && m.available)
          ? cur : (sorted.find((m) => m.available) || sorted[0]).id));
      })
      .catch(() => setBackendState((cur) => cur || 'local'));
  }, []);

  // deep link for demos: /app?alert=ALT-001&mode=replay, or a landing-page launch
  const autoStarted = useRef(null); // StrictMode runs effects twice in dev; start each deep link once
  useEffect(() => {
    if (!autoStart || autoStarted.current === autoStart || online === null) return;
    if (autoStart.mode === 'live' && !online) return;
    autoStarted.current = autoStart;
    inv.start(autoStart.alertId, autoStart.mode, backend);
  }, [autoStart, online]); // eslint-disable-line react-hooks/exhaustive-deps

  const running = Boolean(active) && !run.done && !run.failed && !notice;
  const start = (alertId, mode) => {
    setDrawer(null);
    setFocusStep(null);
    setSelectedId(null);
    inv.start(alertId, mode, backend);
    document.getElementById('ws-graph')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  const openSources = async (ids, title) => {
    setDrawer({ title, loading: true });
    try {
      const res = await fetch(`/api/artifacts?tenant=${TENANT}&ids=${ids.join(',')}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDrawer({ title, eyebrow: 'SOURCE MESSAGES', artifacts: await res.json() });
    } catch (e) {
      setDrawer({ title, text: `Could not load sources (${e.message}). Ids: ${ids.join(', ')}` });
    }
  };
  const openFindings = (ids, title) => {
    const set = new Set(ids);
    setDrawer({ title, eyebrow: 'FINDINGS', findings: run.findings.filter((f) => set.has(f.finding_id)) });
  };
  const onNodeClick = (n) => {
    setSelectedId(n.id);
    if (n.label === 'Artifact') openSources([n.id], n.id);
    else {
      const cited = run.findings.filter((f) => f.cites?.includes(n.id));
      setDrawer({ title: n.name, eyebrow: `${n.label.toUpperCase()} · ${n.id}`, text: cited.length ? `Cited by ${plural(cited.length, 'finding')} in this run.` : 'Not cited by a finding in this run.', findings: cited });
    }
  };
  const focusNode = (id) => {
    const n = nodeById.get(id);
    if (n) onNodeClick(n);
  };

  const version = run.steps.length * 1000 + run.findings.length;
  const touched = inv.touchedNodes.current.size;
  const edges = inv.touchedEdges.current.size;

  return <div className="app-shell">
    <AppRail onBackHome={onBackHome} />
    <div className="app-frame">
      <Header onBackHome={onBackHome} online={online} active={active} model={run.model} backend={backend} setBackend={setBackend} models={models} />
      <div className="app-body">
        <main className="main-content">
          <Overview graph={graph} alerts={alerts} run={run} touched={touched} edges={edges} />
          {notice && <div className="ws-notice"><CircleAlert size={14} /> {notice}<button type="button" onClick={() => inv.setNotice(null)} aria-label="Dismiss"><X size={12} /></button></div>}
          <AlertCards alerts={alerts} active={active} running={running} start={start} loadError={loadError} />
          <div id="ws-graph">
            <InvestigationGraph
              graph={graph}
              touchedNodes={inv.touchedNodes}
              touchedEdges={inv.touchedEdges}
              stepNodes={inv.stepNodes}
              focusStep={focusStep}
              active={active}
              running={running}
              selectedId={selectedId}
              onNodeClick={onNodeClick}
              version={version}
            />
          </div>
          <section className="pulse" id="ws-memory" aria-label="Memory">
            <div className="section-label-row">
              <span className="section-label">REMEMBERED FOR NEXT TIME</span>
              <span className="section-label muted">{run.memories.length} WRITTEN</span>
            </div>
            <ul className="pulse-list">
              {run.memories.length ? run.memories.map((m) => (
                <li key={m.memory_id} className="pulse-row">
                  <span className={`tag ${m.kind === 'procedural' ? 'tag-violet' : 'tag-olive'}`}>{m.kind}</span>
                  <span className="pulse-detail wrap">{m.content}</span>
                </li>
              )) : run.done ? (
                <li className="pulse-row">
                  <span className="tag tag-olive">skipped</span>
                  <span className="pulse-detail wrap">
                    Nothing remembered: memory is only written when the answer has a root cause the validator accepts.
                    {(() => {
                      const why = run.answer?.dropped?.find((d) => d.kind === 'root_cause');
                      return why ? ` The proposed root cause ${why.id} was removed: ${why.reason}.` : ' No root cause was proposed.';
                    })()}
                  </span>
                </li>
              ) : <li className="pulse-row"><span className="pulse-detail">After an investigation the agent writes an episodic memory of what happened and a procedural one about how to investigate it next time.</span></li>}
            </ul>
          </section>
          <footer className="app-footer">
            <div><span className="footer-brand-mark"><BrandGlyph /></span><span>BLINKBRAIN</span><span className="footer-copy-divider">·</span><span>SYNTHETIC DATA · DASHMART IS FICTIONAL</span></div>
            <div><span>THE AGENT HUB IS A UI ELEMENT, NOT A GRAPH NODE</span><span className="footer-copy-divider">·</span><span className="footer-ready"><i className={online ? '' : 'off'} /> {online ? 'SYSTEM READY' : 'API OFFLINE'}</span></div>
          </footer>
        </main>
        <aside className="assistant" aria-label="Investigation">
          {!active && (
            <div className="assistant-intro">
              <h2 className="assistant-title">Why did this alert fire?</h2>
              <p>Pick an alert. An orchestrator dispatches Store Ops, Growth, Facilities and Supply agents; each one queries the graph, and every claim in the answer cites the findings and messages behind it.</p>
            </div>
          )}
          {run.answer && <AnswerDock answer={run.answer} findings={run.findings.length} openSources={openSources} openFindings={openFindings} focusNode={focusNode} />}
          <Timeline run={run} active={active} running={running} focusStep={focusStep} setFocusStep={setFocusStep} />
        </aside>
      </div>
    </div>
    {drawer && <Drawer drawer={drawer} close={() => setDrawer(null)} />}
  </div>;
}

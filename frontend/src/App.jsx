import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import LandingPage from './LandingPage.jsx';
import {
  Activity, ArrowRight, ArrowUpRight, Bell, Boxes, BrainCircuit, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleAlert, Clock3, Code2, Database, ExternalLink, Eye,
  FileText, Flame, GitBranch, LockKeyhole, Maximize2, Minus, MoreHorizontal, Network,
  Plus, RotateCcw, Search, ShieldAlert, ShieldCheck, Snowflake, Sparkles, Users, Workflow, Zap,
  Store, Megaphone, ClipboardList,
} from 'lucide-react';
import { initialFeed, links as mockLinks, nodes as mockNodes, roles, scenarios } from './data/mockCompany.js';
import { askCompanyBrain, fetchCompanyGraph, initialMockGraph, runCompanyScenario } from './services/companyBrainApi.js';

const IconMap = { zap: Zap, snowflake: Snowflake, flame: Flame, shield: ShieldCheck, check: CheckCircle2, file: FileText, megaphone: Megaphone, network: Network };
const NODE_COLORS = {
  Team: '#cbd5e1', Person: '#94a3b8', System: '#0ea5e9', Doc: '#a78bfa',
  Ticket: '#f59e0b', Decision: '#10b981', Store: '#10b981',
};

// Ink-on-cream palette tuned for the light Antimetal-style canvas
const SPHERE_THEMES = {
  system: { light: '#4a4440', base: '#1a1614', shadow: '#1a1614', rim: '#1a1614', glow: 'rgba(26, 22, 20, 0.16)', labelAccent: '#1a1614' },
  decisionActive: { light: '#a3ad4a', base: '#7d8a24', shadow: '#7d8a24', rim: '#5f6a17', glow: 'rgba(125, 138, 36, 0.22)', labelAccent: '#7d8a24' },
  decisionSuperseded: { light: '#c4c2b8', base: '#a8a59b', shadow: '#a8a59b', rim: '#8d8a80', glow: 'rgba(168, 165, 155, 0.2)', labelAccent: '#8d8a80' },
  ticket: { light: '#f59a6a', base: '#e8622b', shadow: '#e8622b', rim: '#c44f1f', glow: 'rgba(232, 98, 43, 0.24)', labelAccent: '#e8622b' },
  staleDoc: { light: '#e57a6f', base: '#c8382d', shadow: '#c8382d', rim: '#9d2a21', glow: 'rgba(200, 56, 45, 0.26)', labelAccent: '#c8382d' },
  doc: { light: '#a99ad8', base: '#7f6cc4', shadow: '#7f6cc4', rim: '#634fa8', glow: 'rgba(127, 108, 196, 0.2)', labelAccent: '#7f6cc4' },
  silverWhite: { light: '#8f8a82', base: '#6e6a63', shadow: '#6e6a63', rim: '#55514b', glow: 'rgba(110, 106, 99, 0.18)', labelAccent: '#55514b' },
  restricted: { light: '#e57a6f', base: '#c8382d', shadow: '#c8382d', rim: '#9d2a21', glow: 'rgba(200, 56, 45, 0.26)', labelAccent: '#c8382d' },
};

function getNodeSphereTheme(node, isStale, isRestricted) {
  if (node.type === 'Doc') {
    if (isStale || node.status === 'STALE') {
      return SPHERE_THEMES.staleDoc;
    }
    return SPHERE_THEMES.doc;
  }
  if (node.type === 'Decision') {
    if (node.status === 'SUPERSEDED') {
      return SPHERE_THEMES.decisionSuperseded;
    }
    return SPHERE_THEMES.decisionActive;
  }
  if (node.type === 'System') {
    return SPHERE_THEMES.system;
  }
  if (node.type === 'Ticket') {
    return SPHERE_THEMES.ticket;
  }
  if (node.type === 'Person' || node.type === 'Team') {
    return SPHERE_THEMES.silverWhite;
  }
  if (isStale) {
    return SPHERE_THEMES.staleDoc;
  }
  return SPHERE_THEMES.silverWhite;
}
const mockCompanyLinks = mockLinks.map(([source, target, label]) => ({ source, target, label }));

function pairKey(a, b) { return [String(a), String(b)].sort().join('::'); }
function getNodeId(value) { return typeof value === 'object' ? value?.id : value; }
function displayType(node) { return node?.type === 'Doc' ? 'DOCUMENT' : node?.type?.toUpperCase() || 'NODE'; }

function drawPill(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

function getNodeRadius(node) {
  switch (node?.type) {
    case 'Team': return 32;
    case 'System': return 28;
    case 'Person': return 26;
    case 'Decision': return 26;
    case 'Ticket': return 26;
    case 'Doc': return 25;
    default: return 24;
  }
}

function createCollideForce(radiusFn, strength = 0.72, iterations = 2) {
  let nodes = [];
  function force(alpha) {
    const n = nodes.length;
    // Maintain overlap protection even during low-alpha settled and idle states
    const alphaFactor = Math.max(0.28, Math.min(alpha * 3, 1));
    for (let it = 0; it < iterations; it++) {
      for (let i = 0; i < n; i++) {
        const nodeA = nodes[i];
        const rA = typeof radiusFn === 'function' ? radiusFn(nodeA) : radiusFn;
        for (let j = i + 1; j < n; j++) {
          const nodeB = nodes[j];
          const rB = typeof radiusFn === 'function' ? radiusFn(nodeB) : radiusFn;
          const minDistance = rA + rB;
          let dx = nodeB.x - nodeA.x;
          let dy = nodeB.y - nodeA.y;
          let l2 = dx * dx + dy * dy;
          if (l2 < minDistance * minDistance) {
            if (l2 === 0) {
              dx = (Math.random() - 0.5) * 1e-2;
              dy = (Math.random() - 0.5) * 1e-2;
              l2 = dx * dx + dy * dy;
            }
            const l = Math.sqrt(l2);
            const overlap = (minDistance - l) / l;
            const adjust = overlap * 0.5 * strength * alphaFactor;
            const adjX = dx * adjust;
            const adjY = dy * adjust;
            if (nodeA.fx == null) {
              nodeA.x -= adjX;
              nodeA.vx = (nodeA.vx || 0) - adjX * 0.45;
            }
            if (nodeB.fx == null) {
              nodeB.x += adjX;
              nodeB.vx = (nodeB.vx || 0) + adjX * 0.45;
            }
          }
        }
      }
    }
  }
  force.initialize = function(_nodes) {
    nodes = _nodes;
  };
  return force;
}

function createAmbientForce(getMotionState, getReducedMotion) {
  let nodes = [];
  let tickCount = 0;
  function force() {
    if (getReducedMotion && getReducedMotion()) return;
    const state = getMotionState ? getMotionState() : 'IDLE';
    // Suppress ambient micro-drift during interaction and investigation
    // to keep drag responsive and evidence traversal precise
    if (state === 'INVESTIGATION' || state === 'INTERACTION') return;

    // Ambient amplitude: ultra-subtle in SETTLED, organic breathing in IDLE
    const amp = state === 'SETTLED' ? 0.014 : 0.024;
    tickCount += 0.01;
    const n = nodes.length;
    for (let i = 0; i < n; i++) {
      const node = nodes[i];
      if (node.fx != null || node.fy != null) continue;
      // Golden ratio phase offset for organic, non-repeating gentle drift
      const phase = i * 1.6180339887;
      const driftX = Math.cos(tickCount * 0.6 + phase) * amp;
      const driftY = Math.sin(tickCount * 0.8 + phase) * amp;
      node.vx = (node.vx || 0) + driftX;
      node.vy = (node.vy || 0) + driftY;
    }
  }
  force.initialize = function(_nodes) {
    nodes = _nodes;
  };
  return force;
}

const SCENARIO_CARDS = [
  { id: 'rootcause', tag: 'Root cause', tone: 'orange', icon: Network, time: 'now', title: 'Flash ad failing in South Delhi', detail: 'Campaign traces to a capped freezer at STORE-DELHI-04 via LIN-101.', primary: 'Trace path', secondary: 'View evidence' },
  { id: 'surge', tag: 'Drift · 2 docs stale', tone: 'olive', icon: Zap, time: '2m ago', title: 'Rain surge raised ₹30 → ₹50', detail: 'Partner SLA and monsoon SOP still promise the old ceiling.', primary: 'Review drift', secondary: 'Diff rules' },
  { id: 'checkout', tag: 'P0 · unassigned', tone: 'red', icon: Flame, time: '8m ago', title: 'Checkout promo crash needs an owner', detail: 'Graph history points to the engineer who fixed LIN-202.', primary: 'Delegate', secondary: 'See history' },
  { id: 'access', tag: 'Policy check', tone: 'violet', icon: ShieldCheck, time: '21m ago', title: 'Payout ledger query from Sales', detail: 'RBAC traversal decides before any data reaches the answer.', primary: 'Evaluate', secondary: 'Policy' },
];

function greetingForHour(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function AppRail({ onBackHome }) {
  const items = [
    { icon: Activity, label: 'Overview', active: true },
    { icon: Network, label: 'Company graph' },
    { icon: FileText, label: 'Runbooks' },
    { icon: ShieldCheck, label: 'Access policies' },
  ];
  return <nav className="app-rail" aria-label="Workspace navigation">
    <button type="button" className="rail-brand" onClick={onBackHome} aria-label="Back to BlinkBrain overview" title="Back to overview">
      <BrandGlyph />
    </button>
    <div className="rail-items">
      {items.map(({ icon: I, label, active }) => (
        <button key={label} type="button" className={`rail-item ${active ? 'active' : ''}`} aria-label={label} title={label}>
          <I size={15} strokeWidth={1.7} />
        </button>
      ))}
    </div>
  </nav>;
}

function BrandGlyph() {
  // Original BlinkBrain mark: a 3×3 dot lattice with one lit node
  const dots = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
  return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    {dots.map(([x, y]) => (
      <circle key={`${x}${y}`} cx={3 + x * 6} cy={3 + y * 6} r={x === 1 && y === 1 ? 2.4 : 1.6} className={x === 1 && y === 1 ? 'glyph-hot' : 'glyph-dot'} />
    ))}
  </svg>;
}

function Header({ currentRole, setCurrentRole, backendMode, onBackHome }) {
  return <header className="topbar">
    <div className="topbar-crumbs">
      <button type="button" className="topbar-home-pill" onClick={onBackHome}>← Overview</button>
      <span className="crumb-sep">/</span>
      <span className="crumb">BLINKBRAIN</span>
      <span className="crumb-sep">·</span>
      <span className="crumb crumb-strong">PRODUCTION · NCR</span>
    </div>
    <div className="topbar-right">
      <div className="backend-indicator" title={backendMode === 'live' ? 'Connected to live FalkorDB graph engine' : 'Deterministic demo graph'}>
        <span className={`status-dot ${backendMode === 'live' ? 'live' : 'mock'}`} />
        <span>{backendMode === 'live' ? 'FalkorDB live' : 'Demo mode'}</span>
      </div>
      <label className="role-dropdown" title="Switch viewer role and permissions">
        <Users size={12} className="role-icon" />
        <select
          value={currentRole.id}
          onChange={(e) => setCurrentRole(roles[e.target.value])}
          aria-label="View as role"
        >
          {Object.values(roles).map((role) => (
            <option value={role.id} key={role.id}>
              {role.name} ({role.team})
            </option>
          ))}
        </select>
        <ChevronDown size={11} className="role-chevron" />
      </label>
      <div className="top-avatar" title={`${currentRole.name} · ${currentRole.team}`}>
        {currentRole.initials}
      </div>
    </div>
  </header>;
}

function Sparkline() {
  const pts = [18, 17, 19, 16, 17, 14, 15, 12, 13, 10, 11, 8, 9, 6, 5];
  const d = pts.map((y, i) => `${i === 0 ? 'M' : 'L'}${(i / (pts.length - 1)) * 100},${y}`).join(' ');
  return <svg className="kpi-spark" viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true">
    <path d={`${d} L100,22 L0,22 Z`} className="spark-fill" />
    <path d={d} className="spark-line" />
  </svg>;
}

function ActionBars() {
  const agent = [1, 1, 1, 1, 1, 1, 1, 1, 0.6, 0];
  const human = [1, 1, 0.5, 0.3, 0, 0, 0, 0, 0, 0];
  return <div className="kpi-bars" aria-hidden="true">
    <div><span>AGENT</span>{agent.map((v, i) => <i key={i} className="bar-agent" style={{ opacity: v ? 0.35 + v * 0.65 : 0.12 }} />)}</div>
    <div><span>HUMAN</span>{human.map((v, i) => <i key={i} className="bar-human" style={{ opacity: v ? 0.35 + v * 0.65 : 0.12 }} />)}</div>
  </div>;
}

function OverviewHeader({ currentRole }) {
  const firstName = currentRole.name.split(' ')[0];
  const greeting = greetingForHour(new Date().getHours());
  return <section className="overview">
    <div className="overview-head">
      <div>
        <h1 className="overview-greeting">{greeting}, {firstName}</h1>
        <p className="overview-sub">
          Graph agents traced 1,284 dependencies today · <span className="tone-olive">9 auto-resolved</span> · <span className="tone-orange">4 need you</span>
        </p>
      </div>
      <div className="overview-period">
        <span className="period-label">THIS WEEK</span>
        <span className="period-pill"><b>14</b> incidents prevented</span>
        <span className="period-pill"><b>212</b> alerts grouped</span>
      </div>
    </div>
    <div className="kpi-grid">
      <article className="kpi-card">
        <div className="kpi-label">GRAPH HEALTH <span className="kpi-info">i</span></div>
        <div className="kpi-value">94% <span className="kpi-delta up">▲ 3%</span></div>
        <Sparkline />
        <div className="kpi-foot tone-orange">2 runbooks stale</div>
      </article>
      <article className="kpi-card">
        <div className="kpi-label">MTTR · 7D</div>
        <div className="kpi-value">3m 48s</div>
        <div className="kpi-foot tone-olive">▼ 31% vs prior 7d</div>
      </article>
      <article className="kpi-card">
        <div className="kpi-label">ORDER SLA · 30D</div>
        <div className="kpi-value">99.21%</div>
        <div className="kpi-foot">Above 99.0% 10-min target</div>
      </article>
      <article className="kpi-card">
        <div className="kpi-label">ACTIONS · 14D</div>
        <ActionBars />
        <div className="kpi-foot">92% traced by agents</div>
      </article>
    </div>
  </section>;
}

function DecisionCards({ activeScenario, runScenario }) {
  return <section className="decisions" aria-label="Investigations needing a decision">
    <div className="section-label-row">
      <span className="section-label">NEEDS YOUR DECISION</span>
      <span className="section-label muted">{SCENARIO_CARDS.length} OPEN</span>
    </div>
    <div className="decision-grid" role="tablist" aria-label="Investigation scenarios">
      {SCENARIO_CARDS.map((card) => {
        const I = card.icon;
        const isActive = activeScenario.id === card.id;
        return <article key={card.id} className={`decision-card ${isActive ? 'active' : ''}`}>
          <div className="decision-meta">
            <span className={`tag tag-${card.tone}`}><I size={11} /> {card.tag}</span>
            <span className="tag tag-plain"><Clock3 size={11} /> {isActive ? 'active' : card.time}</span>
          </div>
          <h3 className="decision-title">{card.title}</h3>
          <p className="decision-detail">{card.detail}</p>
          <div className="decision-actions">
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              className="btn-ink"
              onClick={() => runScenario(card.id)}
            >
              <Check size={12} /> {card.primary}
            </button>
            <button type="button" className="btn-ghost" onClick={() => runScenario(card.id)}>{card.secondary}</button>
          </div>
        </article>;
      })}
    </div>
  </section>;
}

function PulseFeed({ feed }) {
  return <section className="pulse" aria-label="Operational pulse">
    <div className="section-label-row">
      <span className="section-label">PULSE</span>
      <span className="section-label muted">VIEW ALL {feed.length}</span>
    </div>
    <ul className="pulse-list">
      {feed.map((item, i) => {
        const tone = item.color === 'red' ? 'red' : item.color === 'amber' ? 'olive' : item.color === 'green' ? 'green' : item.color === 'purple' ? 'violet' : 'orange';
        const label = tone === 'red' ? 'Attention' : tone === 'olive' ? 'Watch' : tone === 'green' ? 'Healthy' : 'Traced';
        return <li key={`${item.id || item.title}-${i}`} className="pulse-row">
          <span className={`tag tag-${tone}`}>{label}</span>
          <span className="pulse-title">{item.title}</span>
          <span className="pulse-detail">— {item.detail}</span>
          <span className="pulse-time">{item.time}</span>
        </li>;
      })}
    </ul>
  </section>;
}

function AssistantPanel({ activeScenario, query, setQuery, onAsk, asking, latestAnswer, inspector }) {
  const prompts = [
    { label: 'ROOT CAUSE', icon: Network, text: 'Why is the Amul Ice-Cream Flash Ad campaign failing?' },
    { label: 'BLAST RADIUS', icon: Zap, text: 'Which documents still mention the ₹30 rain surge?' },
    { label: 'OWNERSHIP', icon: Users, text: 'Who should own the P0 checkout promo crash?' },
  ];
  return <aside className="assistant" aria-label="Ask the company brain">
    <div className="assistant-intro">
      <h2 className="assistant-title">Ask anything about your dark-store network</h2>
      <p>I know your services, stores, runbooks, tickets and the people behind them — every answer comes with its graph path.</p>
    </div>

    <div className="prompt-cards">
      {prompts.map(({ label, icon: I, text }) => (
        <button key={label} type="button" className="prompt-card" onClick={() => setQuery(text)}>
          <span className="prompt-label"><I size={11} /> {label}</span>
          <span className="prompt-text">{text}</span>
        </button>
      ))}
    </div>

    <form className="topbar-search assistant-input" onSubmit={(e) => { e.preventDefault(); onAsk(); }}>
      <Search size={13} className="search-icon" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={activeScenario.question}
        aria-label="Ask the company brain"
      />
      <kbd className="search-kbd">⌘K</kbd>
      <button type="submit" className="search-submit" disabled={asking || !query.trim()} aria-label="Trace query">
        {asking ? <span className="tiny-loader" /> : <ArrowRight size={13} />}
      </button>
    </form>

    <AnswerDock activeScenario={activeScenario} latestAnswer={latestAnswer} />
    {inspector}
  </aside>;
}


function CompanyGraph({
  companyNodes, companyLinks, activeScenario, staleDocs, currentRole,
  focusedNode, setFocusedNode, hoveredNode, setHoveredNode,
  hoveredHopIndex, setHoveredHopIndex, animatingHopIndex, setAnimatingHopIndex,
  revealedHopCount, setRevealedHopCount, animationTick, setAnimationTick,
  graphFilter, setGraphFilter, backendMode
}) {
  const fgRef = useRef(null);
  const canvasHostRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 740, height: 490 });
  const [showLegend, setShowLegend] = useState(false);
  const animationTimersRef = useRef([]);

  // Four distinct motion states: IDLE | INTERACTION | INVESTIGATION | SETTLED
  const [motionState, setMotionState] = useState('IDLE');
  const motionStateRef = useRef('IDLE');
  useEffect(() => {
    motionStateRef.current = motionState;
  }, [motionState]);

  // Reduced motion preferences
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const prefersReducedMotionRef = useRef(prefersReducedMotion);
  useEffect(() => {
    prefersReducedMotionRef.current = prefersReducedMotion;
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => setPrefersReducedMotion(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else if (mq.addListener) {
      mq.addListener(handler);
      return () => mq.removeListener(handler);
    }
  }, []);

  // Page Visibility API to pause rendering when tab is hidden (CPU optimization)
  useEffect(() => {
    const handleVisibility = () => {
      const fg = fgRef.current;
      if (!fg) return;
      if (document.hidden) {
        fg.pauseAnimation?.();
      } else {
        fg.resumeAnimation?.();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const pathSignature = activeScenario.path.join('|');
  const pathSet = useMemo(() => new Set(activeScenario.path), [pathSignature]);
  const staleSet = useMemo(() => new Set(staleDocs || []), [staleDocs?.join('|')]);
  const restrictedSet = useMemo(() => new Set(companyNodes.filter((n) => n.restricted && currentRole.id !== 'dev').map((n) => n.id)), [companyNodes, currentRole.id]);

  // Revealed path slice based on current animation hop progress
  const revealedPath = useMemo(() => activeScenario.path.slice(0, revealedHopCount), [pathSignature, revealedHopCount]);
  const revealedSet = useMemo(() => new Set(revealedPath), [revealedPath]);

  // Requirement 2: Highlight ONLY the relationships connecting consecutive entities in the returned path
  const revealedEdgePairs = useMemo(() => {
    const pairs = new Set();
    for (let i = 0; i < revealedPath.length - 1; i++) {
      pairs.add(pairKey(revealedPath[i], revealedPath[i + 1]));
    }
    return pairs;
  }, [revealedPath]);

  // Connected path prefix when hovering a hop in the Explainability X-Ray inspector
  const hoveredPathSlice = useMemo(() => {
    if (hoveredHopIndex == null) return [];
    return activeScenario.path.slice(0, hoveredHopIndex + 1);
  }, [pathSignature, hoveredHopIndex]);

  const hoveredEdgePairs = useMemo(() => {
    const pairs = new Set();
    for (let i = 0; i < hoveredPathSlice.length - 1; i++) {
      pairs.add(pairKey(hoveredPathSlice[i], hoveredPathSlice[i + 1]));
    }
    return pairs;
  }, [hoveredPathSlice]);

  const visibleNodes = useMemo(() => companyNodes.filter((n) => graphFilter === 'path' ? pathSet.has(n.id) : graphFilter === 'restricted' ? (n.restricted || n.id === 'user-kabir' || n.id === 'team-sales') : true), [companyNodes, graphFilter, pathSignature]);
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const graphData = useMemo(() => {
    const nodes = visibleNodes.map((node) => ({ ...node, x: (node.x ?? 450) - 450, y: (node.y ?? 285) - 285 }));
    const nodeIds = new Set(nodes.map((node) => node.id));
    const links = companyLinks.filter((link) => nodeIds.has(String(getNodeId(link.source))) && nodeIds.has(String(getNodeId(link.target)))).map((link) => ({ ...link, source: String(getNodeId(link.source)), target: String(getNodeId(link.target)) }));
    const accessBlocked = activeScenario.id === 'access' && currentRole.id !== 'dev';
    if (accessBlocked && nodeIds.has('team-sales') && nodeIds.has('sys-payout') && !links.some((link) => pairKey(getNodeId(link.source), getNodeId(link.target)) === pairKey('team-sales', 'sys-payout'))) {
      links.push({ source: 'team-sales', target: 'sys-payout', label: 'ATTEMPTED_ACCESS', synthetic: true });
    }
    return { nodes, links };
  }, [visibleNodes, companyLinks, activeScenario.id, currentRole.id]);

  const nodeMap = useMemo(() => new Map(graphData.nodes.map((node) => [node.id, node])), [graphData.nodes]);

  const visiblePathIds = useMemo(() => activeScenario.path.filter((id) => visibleIds.has(id)), [pathSignature, visibleIds]);

  // Obsidian-style neighborhood lookup
  const neighborsByNode = useMemo(() => {
    const map = new Map();
    graphData.nodes.forEach((n) => map.set(n.id, new Set()));
    graphData.links.forEach((l) => {
      const s = String(getNodeId(l.source));
      const t = String(getNodeId(l.target));
      map.get(s)?.add(t);
      map.get(t)?.add(s);
    });
    return map;
  }, [graphData]);

  // Responsive canvas observer
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return undefined;
    const updateSize = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasSize({ width: Math.max(320, Math.round(rect.width)), height: Math.max(300, Math.round(rect.height)) });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  // Configure native D3 force physics for organic Obsidian layout
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    // 1. Natural repulsion: restrained, non-violent spreading
    fg.d3Force('charge')
      ?.strength(-175)
      ?.distanceMin(22)
      ?.distanceMax(390);

    // 2. Spring-like link attraction: tighter for traversed provenance, spacious for background
    fg.d3Force('link')
      ?.distance((link) => (revealedEdgePairs.has(pairKey(getNodeId(link.source), getNodeId(link.target))) ? 68 : 88))
      ?.strength(0.52);

    // 3. Center anchor: soft gravity toward center
    fg.d3Force('center')?.strength(0.035);

    // 4. Overlap prevention collision force with sustained low-alpha protection
    fg.d3Force('collide', createCollideForce(getNodeRadius, 0.72, 2));

    // 5. State-aware subtle ambient living movement
    fg.d3Force('ambient', createAmbientForce(() => motionStateRef.current, () => prefersReducedMotionRef.current));
  }, [graphData, revealedEdgePairs]);

  // Center on focused node when it changes
  useEffect(() => {
    if (!focusedNode) return;
    const n = graphData.nodes.find((node) => node.id === focusedNode);
    if (n && typeof n.x === 'number' && typeof n.y === 'number') {
      const duration = prefersReducedMotion ? 0 : 450;
      fgRef.current?.centerAt(n.x, n.y, duration);
    }
  }, [focusedNode, graphData.nodes, prefersReducedMotion]);

  // Initial fit
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !companyNodes.length) return;
    const duration = prefersReducedMotion ? 0 : 650;
    const timer = window.setTimeout(() => fg.zoomToFit(duration, 52), 260);
    return () => window.clearTimeout(timer);
  }, [companyNodes.length, canvasSize.width, canvasSize.height, prefersReducedMotion]);

  // Safe timer cancellation helper
  const clearAnimationTimers = useCallback(() => {
    animationTimersRef.current.forEach((id) => window.clearTimeout(id));
    animationTimersRef.current = [];
  }, []);

  // Reheat force simulation during scenario runs or graph updates
  useEffect(() => {
    fgRef.current?.d3ReheatSimulation?.();
  }, [activeScenario.id, companyNodes.length, animationTick, currentRole.id]);

  const replayPathAnimation = useCallback(() => {
    setAnimationTick((t) => t + 1);
  }, [setAnimationTick]);

  // Requirement 1, 3, 7, 8, 10: Step-by-step traversal animation with directional particles & smooth framing
  useEffect(() => {
    const fullPath = visiblePathIds;
    if (!fullPath.length) return;

    // 10. Cancel obsolete animations cleanly
    clearAnimationTimers();

    // If reduced-motion is preferred, skip step timeouts and reveal instantly
    if (prefersReducedMotion) {
      setRevealedHopCount(fullPath.length);
      setAnimatingHopIndex(-1);
      setFocusedNode(fullPath[fullPath.length - 1]);
      setMotionState('SETTLED');
      fgRef.current?.zoomToFit(0, 85, (node) => fullPath.includes(node.id));
      return;
    }

    // Four Motion States: Set to INVESTIGATION during active playback
    setMotionState('INVESTIGATION');

    // 1. Highlight path in exact order received, starting at entity 0
    setRevealedHopCount(1);
    setAnimatingHopIndex(0);
    setFocusedNode(fullPath[0]);

    // 8. Reheat simulation so new nodes enter naturally & nearby entities react organically
    fgRef.current?.d3ReheatSimulation?.();

    const HOP_STEP_MS = 480;

    // 3. Animate traversal one hop at a time, emitting directional particles along consecutive edges
    for (let i = 1; i < fullPath.length; i++) {
      const timer = window.setTimeout(() => {
        const prevId = fullPath[i - 1];
        const nextId = fullPath[i];

        setRevealedHopCount(i + 1);
        setAnimatingHopIndex(i);
        setFocusedNode(nextId);

        // Smooth camera follows the active evidence hop
        const targetNode = nodeMap.get(nextId);
        if (targetNode && typeof targetNode.x === 'number' && typeof targetNode.y === 'number') {
          fgRef.current?.centerAt(targetNode.x, targetNode.y, 400);
        }

        // Find relevant edge connecting consecutive entities in the path
        const edge = graphData.links.find((l) => {
          const s = String(getNodeId(l.source));
          const t = String(getNodeId(l.target));
          return pairKey(s, t) === pairKey(prevId, nextId);
        });
        if (edge) {
          fgRef.current?.emitParticle(edge);
        }
      }, i * HOP_STEP_MS);
      animationTimersRef.current.push(timer);
    }

    // 7. Smoothly frame the relevant subgraph after scenario completes and transition to SETTLED
    const completeTimer = window.setTimeout(() => {
      setAnimatingHopIndex(-1);
      setMotionState('SETTLED');

      const fgCurrent = fgRef.current;
      if (fgCurrent) {
        fgCurrent.zoomToFit(750, 95, (node) => fullPath.includes(node.id));
      }

      // Clamp zoom to avoid excessive zoom-in on tight 2-3 node paths
      const clampTimer = window.setTimeout(() => {
        const curZoom = fgRef.current?.zoom?.();
        if (typeof curZoom === 'number' && curZoom > 1.65) {
          fgRef.current?.zoom(1.65, 300);
        }
      }, 760);
      animationTimersRef.current.push(clampTimer);
    }, fullPath.length * HOP_STEP_MS + 240);
    animationTimersRef.current.push(completeTimer);

    return () => {
      clearAnimationTimers();
    };
  }, [pathSignature, graphFilter, animationTick, clearAnimationTimers, visiblePathIds, setRevealedHopCount, setAnimatingHopIndex, setFocusedNode, graphData.links, nodeMap, prefersReducedMotion]);

  // Link status checkers
  const isDeniedLink = useCallback((link) => {
    const s = String(getNodeId(link.source));
    const t = String(getNodeId(link.target));
    return activeScenario.id === 'access' && currentRole.id !== 'dev' && (link.synthetic || pairKey(s, t) === pairKey('team-sales', 'sys-payout'));
  }, [activeScenario.id, currentRole.id]);

  // Requirement 2: Highlight only relationships connecting consecutive entities in the returned path
  const isTraversedLink = useCallback((link) => {
    const s = String(getNodeId(link.source));
    const t = String(getNodeId(link.target));
    const k = pairKey(s, t);
    if (isDeniedLink(link)) {
      return revealedSet.has('team-sales') && revealedSet.has('sys-payout');
    }
    return revealedEdgePairs.has(k) || hoveredEdgePairs.has(k);
  }, [isDeniedLink, revealedSet, revealedEdgePairs, hoveredEdgePairs]);

  const isHoveredPrefixLink = useCallback((link) => {
    if (hoveredHopIndex == null) return false;
    const s = String(getNodeId(link.source));
    const t = String(getNodeId(link.target));
    return hoveredEdgePairs.has(pairKey(s, t));
  }, [hoveredHopIndex, hoveredEdgePairs]);

  const isNeighborLink = useCallback((link) => {
    if (!hoveredNode) return false;
    const s = String(getNodeId(link.source));
    const t = String(getNodeId(link.target));
    return s === hoveredNode || t === hoveredNode;
  }, [hoveredNode]);

  const isStaleLink = useCallback((link) => {
    const s = String(getNodeId(link.source));
    const t = String(getNodeId(link.target));
    return (staleSet.has(s) || staleSet.has(t)) && isTraversedLink(link);
  }, [staleSet, isTraversedLink]);

  // Native Link Styling Accessors
  const getLinkColor = useCallback((link) => {
    if (isDeniedLink(link)) return 'rgba(200, 56, 45, 0.9)';
    if (isStaleLink(link)) return 'rgba(200, 56, 45, 0.75)';
    if (isHoveredPrefixLink(link)) return 'rgba(232, 98, 43, 1)';
    if (isTraversedLink(link)) return 'rgba(232, 98, 43, 0.9)';
    if (isNeighborLink(link)) return 'rgba(26, 22, 20, 0.45)';
    // Requirement 6: Dim unrelated links into the background during an explanation
    if (revealedHopCount > 0 || hoveredNode) {
      return 'rgba(26, 22, 20, 0.07)';
    }
    return 'rgba(26, 22, 20, 0.18)';
  }, [isDeniedLink, isStaleLink, isHoveredPrefixLink, isTraversedLink, isNeighborLink, revealedHopCount, hoveredNode]);

  const getLinkWidth = useCallback((link) => {
    if (isDeniedLink(link)) return 2.2;
    if (isStaleLink(link)) return 2.2;
    if (isHoveredPrefixLink(link)) return 2.4;
    if (isTraversedLink(link)) return 2.0;
    if (isNeighborLink(link)) return 1.4;
    return 0.75;
  }, [isDeniedLink, isStaleLink, isHoveredPrefixLink, isTraversedLink, isNeighborLink]);

  const getLinkCurvature = useCallback((link) => {
    if (isDeniedLink(link)) return 0.12;
    if (isTraversedLink(link)) return 0.04;
    return 0.02;
  }, [isDeniedLink, isTraversedLink]);

  const getLinkLineDash = useCallback((link) => {
    if (isDeniedLink(link)) return [5, 4];
    if (isStaleLink(link)) return [4, 3];
    return null;
  }, [isDeniedLink, isStaleLink]);

  const getLinkParticles = useCallback((link) => {
    if (isDeniedLink(link)) return 0;
    if (isHoveredPrefixLink(link)) return 4;
    if (isTraversedLink(link)) return 3;
    if (isNeighborLink(link)) return 1;
    return 0;
  }, [isDeniedLink, isHoveredPrefixLink, isTraversedLink, isNeighborLink]);

  const getLinkParticleWidth = useCallback((link) => {
    if (isHoveredPrefixLink(link)) return 2.6;
    if (isTraversedLink(link)) return 2.4;
    if (isNeighborLink(link)) return 1.8;
    return 1.2;
  }, [isHoveredPrefixLink, isTraversedLink, isNeighborLink]);

  // Requirement 3: Directional particle moving along edge in traversal order
  const getLinkParticleSpeed = useCallback((link) => {
    const s = String(getNodeId(link.source));
    const t = String(getNodeId(link.target));
    const p = activeScenario.path;
    for (let i = 0; i < p.length - 1; i++) {
      if (p[i] === s && p[i + 1] === t) return 0.008; // forward
      if (p[i] === t && p[i + 1] === s) return -0.008; // reverse
    }
    return 0.006;
  }, [activeScenario.path]);

  const getLinkParticleColor = useCallback((link) => {
    if (isDeniedLink(link)) return '#c8382d';
    if (isStaleLink(link)) return '#c8382d';
    if (isTraversedLink(link)) return '#e8622b';
    return '#1a1614';
  }, [isDeniedLink, isStaleLink, isTraversedLink]);

  const getLinkArrowLength = useCallback((link) => {
    if (isDeniedLink(link)) return 0;
    const s = String(getNodeId(link.source));
    const t = String(getNodeId(link.target));
    const p = activeScenario.path;
    for (let i = 0; i < p.length - 1; i++) {
      if (p[i] === s && p[i + 1] === t && (revealedEdgePairs.has(pairKey(s, t)) || hoveredEdgePairs.has(pairKey(s, t)))) {
        return 5.0;
      }
    }
    if (isNeighborLink(link)) return 3.2;
    return 0;
  }, [activeScenario.path, revealedEdgePairs, hoveredEdgePairs, isDeniedLink, isNeighborLink]);

  const getLinkArrowColor = useCallback((link) => {
    if (isTraversedLink(link)) return '#e8622b';
    return 'rgba(26, 22, 20, 0.5)';
  }, [isTraversedLink]);

  // Obsidian-inspired 3D Sphere Node Canvas Rendering
  const paintNode = useCallback((node, ctx, globalScale) => {
    const stale = staleSet.has(node.id) || node.status === 'STALE';
    const restricted = restrictedSet.has(node.id);
    const inPath = pathSet.has(node.id);
    const revealed = revealedSet.has(node.id);
    const inHoveredPrefix = hoveredPathSlice.includes(node.id);
    const isCurrentlyTraversing = animatingHopIndex >= 0 && activeScenario.path[animatingHopIndex] === node.id;
    const focused = focusedNode === node.id;
    const hovered = hoveredNode === node.id;
    const isNeighbor = hoveredNode && (node.id === hoveredNode || neighborsByNode.get(hoveredNode)?.has(node.id));

    // Requirement 6: Dim unrelated nodes during an explanation, while keeping them discoverable in the background
    const isRelevant = revealed || inHoveredPrefix || focused || hovered || isNeighbor || (stale && inPath);
    const dimmed = (revealedHopCount > 0 || hoveredNode) && !isRelevant;

    const isCoreSystem = node.id === 'sys-surge' || node.id === 'sys-inv' || node.id === 'sys-checkout' || node.id === 'sys-payout';
    let baseR = 7.0;
    if (node.type === 'Team') baseR = 9.8;
    else if (isCoreSystem) baseR = 9.0;
    else if (node.type === 'System') baseR = 8.2;
    else if (node.type === 'Decision') baseR = 7.6;
    else if (node.type === 'Ticket') baseR = 7.6;
    else if (node.type === 'Doc') baseR = 7.0;
    else if (node.type === 'Person') baseR = 6.8;

    let r = baseR;
    if (focused || isCurrentlyTraversing) r *= 1.15;
    else if (revealed || inPath || inHoveredPrefix) r *= 1.08;
    else if (hovered) r *= 1.10;

    const theme = getNodeSphereTheme(node, stale, restricted);

    ctx.save();
    ctx.globalAlpha = dimmed ? 0.18 : 1.0;

    // 1. Ambient Outer Glow & Traversal Halo Ring
    if ((revealed || inHoveredPrefix || focused || hovered || stale || isCurrentlyTraversing) && !dimmed) {
      const glowDist = (focused || isCurrentlyTraversing) ? 12 : inPath ? 7.5 : 5.0;
      const glowRadius = r + glowDist;
      const glowGrad = ctx.createRadialGradient(node.x, node.y, r * 0.7, node.x, node.y, glowRadius);
      glowGrad.addColorStop(0, theme.glow);
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      // Sharp accent ring on currently traversing / focused / revealed node
      if (isCurrentlyTraversing || focused || revealed || inHoveredPrefix) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + (isCurrentlyTraversing ? 4.2 : focused ? 3.8 : 2.6), 0, Math.PI * 2);
        ctx.strokeStyle = (isCurrentlyTraversing || focused) ? '#e8622b' : theme.base;
        ctx.lineWidth = (isCurrentlyTraversing ? 1.4 : focused ? 1.1 : 0.8) / Math.max(globalScale, 0.6);
        ctx.stroke();
      }
    }

    // 2. Hub Node Subtle Orbital Ring (Team Nodes)
    if (node.type === 'Team') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 3.4, 0, Math.PI * 2);
      ctx.strokeStyle = focused ? 'rgba(232, 98, 43, 0.7)' : 'rgba(26, 22, 20, 0.28)';
      ctx.lineWidth = 0.75 / Math.max(globalScale, 0.6);
      const dashLen = 2.4 / Math.max(globalScale, 0.6);
      ctx.setLineDash([dashLen, dashLen * 1.5]);
      ctx.stroke();
      ctx.restore();
    }

    // 3. 3D Sphere Body with Radial Gradient
    const lightX = node.x - r * 0.32;
    const lightY = node.y - r * 0.32;

    const sphereGrad = ctx.createRadialGradient(
      lightX, lightY, r * 0.06,
      node.x, node.y, r
    );
    sphereGrad.addColorStop(0.0, theme.light);
    sphereGrad.addColorStop(0.40, theme.base);
    sphereGrad.addColorStop(0.82, theme.shadow);
    sphereGrad.addColorStop(1.0, theme.rim);

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.fillStyle = sphereGrad;
    ctx.fill();

    // Hairline silhouette edge
    ctx.strokeStyle = (focused || isCurrentlyTraversing)
      ? '#f7f6f0'
      : (revealed || hovered || inHoveredPrefix)
      ? theme.rim
      : 'rgba(247, 246, 240, 0.9)';
    ctx.lineWidth = ((focused || isCurrentlyTraversing) ? 1.2 : 0.65) / Math.max(globalScale, 0.6);
    ctx.stroke();

    // 4. Soft Specular Highlight
    const specularGrad = ctx.createRadialGradient(
      lightX, lightY, 0,
      lightX, lightY, r * 0.44
    );
    specularGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.18)');
    specularGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.04)');
    specularGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0)');

    ctx.beginPath();
    ctx.arc(lightX, lightY, r * 0.44, 0, Math.PI * 2);
    ctx.fillStyle = specularGrad;
    ctx.fill();

    // 5. Badges: Restricted Lock Badge
    if (restricted) {
      const lx = node.x + r * 0.72;
      const ly = node.y - r * 0.72;
      const badgeR = 4.6 / Math.max(globalScale, 0.6);
      ctx.beginPath();
      ctx.arc(lx, ly, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = '#f7f6f0';
      ctx.fill();
      ctx.strokeStyle = '#c8382d';
      ctx.lineWidth = 1.0 / Math.max(globalScale, 0.6);
      ctx.stroke();

      const s = badgeR * 0.45;
      ctx.beginPath();
      ctx.arc(lx, ly - s * 0.5, s * 0.75, Math.PI, 0);
      ctx.strokeStyle = '#c8382d';
      ctx.lineWidth = 0.9 / Math.max(globalScale, 0.6);
      ctx.stroke();

      ctx.fillStyle = '#c8382d';
      ctx.fillRect(lx - s, ly, s * 2, s * 1.4);
    }

    // 6. Badges: Stale Warning Badge
    if (stale) {
      const sx = node.x + r * 0.72 + (restricted ? 6 / Math.max(globalScale, 0.6) : 0);
      const sy = node.y - r * 0.72;
      const badgeR = 4.4 / Math.max(globalScale, 0.6);
      ctx.beginPath();
      ctx.arc(sx, sy, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = '#c8382d';
      ctx.fill();
      ctx.strokeStyle = '#f7f6f0';
      ctx.lineWidth = 1.0 / Math.max(globalScale, 0.6);
      ctx.stroke();

      ctx.fillStyle = '#f7f6f0';
      const bw = 1.2 / Math.max(globalScale, 0.6);
      const bh = 2.4 / Math.max(globalScale, 0.6);
      ctx.fillRect(sx - bw / 2, sy - badgeR * 0.55, bw, bh);
      ctx.fillRect(sx - bw / 2, sy + badgeR * 0.25, bw, bw);
    }

    // 7. Zoom-Responsive Node Label
    const isPrioritized = inPath || revealed || inHoveredPrefix || focused || hovered || stale || isNeighbor || isCurrentlyTraversing;
    let labelAlpha = 0;
    if (isPrioritized) {
      labelAlpha = 1.0;
    } else if (globalScale >= 0.65) {
      labelAlpha = Math.min(1.0, (globalScale - 0.65) / 0.55);
    }

    if (labelAlpha > 0.03) {
      ctx.save();
      ctx.globalAlpha = (dimmed ? 0.20 : 1.0) * labelAlpha;

      const label = node.label || node.id;
      const fontSize = Math.max(8.5, Math.min(12, 9.5 / Math.pow(Math.max(globalScale, 0.5), 0.72)));
      ctx.font = `400 ${fontSize}px "Geist Mono", "DM Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Smart label placement: if a neighbor is directly below, place label above to avoid overlap
      let placeAbove = false;
      const neighbors = neighborsByNode.get(node.id);
      if (neighbors && neighbors.size > 0) {
        for (const nid of neighbors) {
          const neighbor = nodeMap.get(nid);
          if (neighbor && typeof neighbor.x === 'number' && typeof neighbor.y === 'number') {
            const dx = neighbor.x - node.x;
            const dy = neighbor.y - node.y;
            if (Math.abs(dx) < 32 && dy > 0 && dy < 44) {
              placeAbove = true;
              break;
            }
          }
        }
      }

      const textMetrics = ctx.measureText(label);
      const textWidth = textMetrics.width;
      const padX = 5.0 / Math.max(globalScale, 0.6);
      const labelHeight = 13.5 / Math.max(globalScale, 0.6);
      const offsetDist = r + 7.0 / Math.max(globalScale, 0.6);
      const labelY = placeAbove ? node.y - offsetDist : node.y + offsetDist;

      const w = textWidth + padX * 2;
      const h = labelHeight;
      const lx = node.x - w / 2;
      const ly = labelY - h / 2;
      const cr = 3.5 / Math.max(globalScale, 0.6);

      ctx.beginPath();
      drawPill(ctx, lx, ly, w, h, cr);
      ctx.fillStyle = (focused || isCurrentlyTraversing || revealed)
        ? 'rgba(255, 255, 255, 0.98)'
        : 'rgba(247, 246, 240, 0.92)';
      ctx.fill();

      ctx.strokeStyle = (focused || isCurrentlyTraversing)
        ? 'rgba(232, 98, 43, 0.7)'
        : (revealed || inPath || inHoveredPrefix)
        ? `${theme.labelAccent}66`
        : 'rgba(26, 22, 20, 0.12)';
      ctx.lineWidth = 0.65 / Math.max(globalScale, 0.6);
      ctx.stroke();

      ctx.fillStyle = stale
        ? '#c8382d'
        : (focused || isCurrentlyTraversing)
        ? '#1a1614'
        : (revealed || inPath || inHoveredPrefix)
        ? '#1a1614'
        : '#6e6a63';
      ctx.fillText(label, node.x, labelY);

      ctx.restore();
    }

    ctx.restore();
  }, [staleSet, restrictedSet, pathSet, revealedSet, hoveredPathSlice, animatingHopIndex, activeScenario.path, focusedNode, hoveredNode, neighborsByNode, revealedHopCount, nodeMap]);

  // Generous hit-testing area for smooth mouse tracking
  const paintPointerArea = useCallback((node, color, ctx) => {
    const isCoreSystem = node.id === 'sys-surge' || node.id === 'sys-inv' || node.id === 'sys-checkout' || node.id === 'sys-payout';
    const baseR = node.type === 'Team' ? 10.0 : isCoreSystem ? 9.2 : node.type === 'System' ? 8.4 : 7.6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, baseR + 8, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const handleNodeClick = useCallback((node) => {
    setMotionState('INTERACTION');
    setFocusedNode(node.id);
    if (typeof node.x === 'number' && typeof node.y === 'number') {
      const duration = prefersReducedMotion ? 0 : 420;
      fgRef.current?.centerAt(node.x, node.y, duration);
      fgRef.current?.zoom(1.5, duration);
    }
    const settleTimer = window.setTimeout(() => {
      setMotionState(revealedHopCount > 1 ? 'SETTLED' : 'IDLE');
    }, 450);
    animationTimersRef.current.push(settleTimer);
  }, [setFocusedNode, revealedHopCount, prefersReducedMotion]);

  const handleNodeHover = useCallback((node) => {
    setHoveredNode(node?.id || null);
    if (!node) {
      setHoveredHopIndex(null);
    }
  }, [setHoveredNode, setHoveredHopIndex]);

  const handleBackgroundClick = useCallback(() => {
    setHoveredNode(null);
    setHoveredHopIndex(null);
    if (graphFilter === 'all') {
      setMotionState('IDLE');
    }
  }, [setHoveredNode, setHoveredHopIndex, graphFilter]);

  const handleNodeDrag = useCallback((node, translate) => {
    setMotionState('INTERACTION');
    // Dynamic physical reaction: impart subtle impulse to immediate neighbors
    const neighborIds = neighborsByNode.get(node.id);
    if (neighborIds && neighborIds.size > 0 && translate) {
      const dx = (translate.x || 0) * 0.14;
      const dy = (translate.y || 0) * 0.14;
      neighborIds.forEach((nid) => {
        const neighbor = nodeMap.get(nid);
        if (neighbor && neighbor.fx == null) {
          neighbor.vx = (neighbor.vx || 0) + dx;
          neighbor.vy = (neighbor.vy || 0) + dy;
        }
      });
    }
  }, [neighborsByNode, nodeMap]);

  const handleNodeDragEnd = useCallback((node) => {
    delete node.fx;
    delete node.fy;
    // Gentle velocity damping to prevent violent bouncing or spinning
    node.vx = (node.vx || 0) * 0.22;
    node.vy = (node.vy || 0) * 0.22;

    fgRef.current?.d3ReheatSimulation?.();

    const settleTimer = window.setTimeout(() => {
      setMotionState(revealedHopCount > 1 ? 'SETTLED' : 'IDLE');
    }, 550);
    animationTimersRef.current.push(settleTimer);
  }, [revealedHopCount]);

  const focusPath = () => {
    setGraphFilter('path');
    window.setTimeout(() => fgRef.current?.zoomToFit(600, 75, (node) => activeScenario.path.includes(node.id)), 120);
  };

  return <section className="panel graph-panel">
    <div className="graph-head">
      <div className="graph-title-group">
        <div className="panel-eyebrow">LIVE TOPOLOGY</div>
        <h2>Company graph <span className={`graph-live-pill motion-${motionState.toLowerCase()}`}><span /> {motionState}</span></h2>
      </div>
      <div className="graph-head-actions">
        <div className="graph-filter" role="group" aria-label="Graph filter">
          <button className={graphFilter === 'all' ? 'on' : ''} onClick={() => setGraphFilter('all')}>All <span>{companyNodes.length}</span></button>
          <button className={graphFilter === 'path' ? 'on' : ''} onClick={focusPath}>Trace path <span>{activeScenario.path.length}</span></button>
          <button className={graphFilter === 'restricted' ? 'on' : ''} onClick={() => setGraphFilter('restricted')}><LockKeyhole size={11} /> Restricted</button>
        </div>
        <button
          className={`icon-button small ${showLegend ? 'active-toggle' : ''}`}
          title={showLegend ? 'Hide legend' : 'Show legend'}
          onClick={() => setShowLegend((v) => !v)}
        >
          <Eye size={13} />
        </button>
        <button className="icon-button small" title="Fit graph" onClick={() => { setGraphFilter('all'); fgRef.current?.zoomToFit(650, 55); }}>
          <Maximize2 size={13} />
        </button>
      </div>
    </div>
    <div className="graph-canvas" ref={canvasHostRef}>
      <div className="graph-grid" />
      {showLegend && (
        <div className="floating-legend">
          <div className="floating-legend-head">
            <span>ENTITY TYPES</span>
            <button onClick={() => setShowLegend(false)} aria-label="Close legend">×</button>
          </div>
          <div className="floating-legend-items">
            <span><i className="legend-shape shape-team" /> Team</span>
            <span><i className="legend-shape shape-person" /> Person</span>
            <span><i className="legend-shape shape-system" /> System</span>
            <span><i className="legend-shape shape-decision" /> Decision</span>
            <span><i className="legend-shape shape-ticket" /> Ticket</span>
            <span><i className="legend-shape shape-doc" /> Document</span>
            <span><i className="legend-shape shape-stale" /> Stale</span>
          </div>
        </div>
      )}
      <div className="graph-force"><ForceGraph2D
        ref={fgRef}
        width={canvasSize.width}
        height={canvasSize.height}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        autoPauseRedraw={false}
        cooldownTicks={Infinity}
        warmupTicks={25}
        d3AlphaDecay={0.024}
        d3VelocityDecay={0.44}
        enableNodeDrag
        enableZoomInteraction
        enablePanInteraction
        onNodeDrag={handleNodeDrag}
        onNodeDragEnd={handleNodeDragEnd}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onBackgroundClick={handleBackgroundClick}
        nodeRelSize={6}
        nodeCanvasObjectMode={() => 'replace'}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={paintPointerArea}
        linkColor={getLinkColor}
        linkWidth={getLinkWidth}
        linkLineDash={getLinkLineDash}
        linkCurvature={getLinkCurvature}
        linkDirectionalParticles={prefersReducedMotion ? 0 : getLinkParticles}
        linkDirectionalParticleWidth={getLinkParticleWidth}
        linkDirectionalParticleSpeed={prefersReducedMotion ? 0 : getLinkParticleSpeed}
        linkDirectionalParticleColor={getLinkParticleColor}
        linkDirectionalArrowLength={getLinkArrowLength}
        linkDirectionalArrowRelPos={0.88}
        linkDirectionalArrowColor={getLinkArrowColor}
        linkHoverPrecision={6}
      /></div>
      {activeScenario.id === 'access' && currentRole.id !== 'dev' && <div className="denied-annotation-overlay"><LockKeyhole size={12} /> 403 · TRAVERSAL BLOCKED</div>}
      <div className="graph-bottom-bar">
        <div className="graph-trace-pill">
          <span className="trace-pulse" />
          <span className="mono">TRACE:</span>
          <b>{activeScenario.path.length} hops</b>
          <span className="trace-sep">·</span>
          <span className="trace-mode">{activeScenario.short}</span>
          <button
            className="graph-replay-btn"
            title="Replay path traversal animation"
            onClick={replayPathAnimation}
          >
            <RotateCcw size={10} /> Replay
          </button>
        </div>
        <div className="graph-zoom-controls">
          <button aria-label="Zoom out" title="Zoom out" onClick={() => fgRef.current?.zoom(Math.max(.35, (fgRef.current?.zoom() || 1) / 1.3), 220)}><Minus size={13} /></button>
          <button aria-label="Reset graph view" title="Fit & Reset" onClick={() => { setFocusedNode(activeScenario.path[0]); setGraphFilter('all'); fgRef.current?.zoomToFit(650, 55); }}><RotateCcw size={12} /></button>
          <button aria-label="Zoom in" title="Zoom in" onClick={() => fgRef.current?.zoom((fgRef.current?.zoom() || 1) * 1.3, 220)}><Plus size={13} /></button>
        </div>
      </div>
    </div>
  </section>;
}

function XRayInspector({
  activeScenario, focusedNode, setFocusedNode,
  hoveredNode, setHoveredNode, hoveredHopIndex, setHoveredHopIndex,
  animatingHopIndex, revealedHopCount,
  companyNodes, staleDocs, currentRole, runScenario
}) {
  const [copiedCypher, setCopiedCypher] = useState(false);
  const nodeById = useMemo(() => Object.fromEntries(companyNodes.map((node) => [node.id, node])), [companyNodes]);
  const focused = nodeById[focusedNode];
  const accessAllowed = activeScenario.id === 'access' && (activeScenario.severity === 'AUTHORIZED' || currentRole.id === 'dev' && !activeScenario.blocked);
  const isAccessBlocked = activeScenario.id === 'access' && !accessAllowed;

  return <aside className="panel xray-panel">
    <div className="panel-header xray-header">
      <div>
        <div className="panel-eyebrow">DECISION PROVENANCE</div>
        <h2>Graph proof</h2>
      </div>
      <button className="icon-button small rerun-button" onClick={() => runScenario(activeScenario.id)} title="Replay investigation">
        <RotateCcw size={13} />
      </button>
    </div>

    {isAccessBlocked && (
      <div className="security-alert-box">
        <ShieldAlert size={14} className="alert-icon" />
        <div className="alert-body">
          <div className="alert-title">403 Access Denied · RBAC Policy</div>
          <div className="alert-desc">Sales role lacks administrative permissions for Rider Payout Ledger.</div>
        </div>
      </div>
    )}

    <div className="trace-summary">
      <div className={`trace-status ${activeScenario.id === 'access' ? (accessAllowed ? 'status-authorized' : 'status-blocked') : activeScenario.id === 'rootcause' ? 'status-warning' : activeScenario.id === 'checkout' ? 'status-critical' : 'status-updated'}`}>
        {activeScenario.id === 'access' ? (accessAllowed ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />) : activeScenario.id === 'rootcause' ? <CircleAlert size={13} /> : activeScenario.id === 'checkout' ? <Flame size={13} /> : <CheckCircle2 size={13} />}
        <span>{activeScenario.id === 'access' ? (accessAllowed ? 'Traversal authorized' : 'Traversal blocked') : activeScenario.id === 'rootcause' ? 'Root cause identified' : activeScenario.id === 'checkout' ? 'Assignee proposed' : 'Knowledge changed'}</span>
        <span className="status-severity">{activeScenario.severity}</span>
      </div>
      <h3>{activeScenario.title}</h3>
      <p>{activeScenario.summary}</p>
    </div>

    <div className="inspector-section-heading">
      <span>HOP-BY-HOP TRACE</span>
      <span className="hop-count">{activeScenario.hops.length} STEPS</span>
    </div>

    <div className="hop-list">
      {activeScenario.hops.map((hop, index) => {
        const I = hop.kind === 'Ticket' ? ClipboardList : hop.kind === 'System' ? Boxes : hop.kind === 'Person' ? Users : hop.kind === 'Store' ? Store : hop.kind === 'Decision' ? GitBranch : hop.kind === 'Team' ? Users : FileText;
        const isSelected = focusedNode === hop.id;
        const isHovered = hoveredHopIndex === index || hoveredNode === hop.id;
        const isAnimating = animatingHopIndex === index;
        const isTraversed = index < revealedHopCount;
        const isPending = index >= revealedHopCount && animatingHopIndex >= 0;
        const stale = hop.stale || staleDocs.includes(hop.id);
        const isDenied = hop.denied && !accessAllowed;

        return <button
          className={`hop-row ${isSelected ? 'selected' : ''} ${isHovered ? 'hop-hovered' : ''} ${isAnimating ? 'hop-animating' : ''} ${isPending ? 'hop-pending' : ''} ${stale ? 'hop-stale' : ''} ${isDenied ? 'hop-denied' : ''}`}
          key={`${hop.id}-${index}`}
          onMouseEnter={() => {
            setHoveredHopIndex(index);
            setHoveredNode(hop.id);
          }}
          onMouseLeave={() => {
            setHoveredHopIndex(null);
            setHoveredNode(null);
          }}
          onClick={() => {
            setFocusedNode(hop.id);
          }}
        >
          <div className="hop-track">
            <span className={`hop-index ${isAnimating ? 'index-animating' : isTraversed ? 'index-traversed' : ''} ${stale ? 'index-stale' : isDenied ? 'index-denied' : ''}`}>
              {String(index + 1).padStart(2, '0')}
            </span>
            {index < activeScenario.hops.length - 1 && (
              <span className={`hop-connector ${stale ? 'connector-stale' : isTraversed ? 'connector-active' : ''}`} />
            )}
          </div>
          <div className="hop-content">
            <div className="hop-topline">
              <span className="hop-relation">{hop.relation}</span>
              {isAnimating ? (
                <span className="mini-status traversing"><span className="pulse-dot" /> TRAVERSING</span>
              ) : stale ? (
                <span className="mini-status stale">STALE</span>
              ) : isDenied ? (
                <span className="mini-status denied">BLOCKED</span>
              ) : isTraversed ? (
                <span className="mini-status traversed"><Check size={8} /> TRAVERSED</span>
              ) : (
                <span className="hop-kind">{hop.kind.toUpperCase()}</span>
              )}
            </div>
            <div className="hop-title"><I size={13} />{hop.title}</div>
            <div className="hop-detail">{hop.detail}</div>
          </div>
          <ChevronRight className="hop-chevron" size={13} />
        </button>;
      })}
    </div>

    <div className="selected-node-card">
      <div className="selected-node-head">
        <div className="selected-node-icon"><Eye size={12} /></div>
        <span>SELECTED ENTITY</span>
        <span className="entity-id">{focused?.id || '—'}</span>
      </div>
      {focused ? <>
        <div className="selected-node-title">{focused.label}</div>
        <div className="entity-properties">
          <div><span>TYPE</span><b>{displayType(focused)}</b></div>
          <div><span>OWNER</span><b>{focused.owner || 'Unassigned'}</b></div>
          <div><span>STATUS</span><b className={staleDocs.includes(focused.id) || focused.status === 'STALE' ? 'red-text' : ''}>{staleDocs.includes(focused.id) || focused.status === 'STALE' ? 'STALE' : focused.status || 'CONNECTED'}</b></div>
        </div>
      </> : <div className="entity-empty">Select a node or trace step to inspect.</div>}
    </div>

    <div className="xray-details-group">
      {activeScenario.id === 'surge' && (
        <details className="accordion-item">
          <summary className="accordion-header">
            <span><Clock3 size={13} /> Superseded memory rule</span>
            <ChevronDown size={12} className="accordion-chevron" />
          </summary>
          <div className="accordion-content old-memory-content">
            <div className="old-memory-rule">Max rain surcharge: <s>₹30</s> → <b>₹50</b></div>
            <div className="old-memory-note">Updated via LIN-104 · Superseded MEM-01</div>
          </div>
        </details>
      )}

      <details className="accordion-item">
        <summary className="accordion-header">
          <span><Code2 size={13} /> Executed Cypher query</span>
          <ChevronDown size={12} className="accordion-chevron" />
        </summary>
        <div className="accordion-content">
          <pre className="cypher-block">{activeScenario.cypher}</pre>
          <button
            className="copy-query-btn"
            onClick={() => {
              navigator.clipboard?.writeText(activeScenario.cypher);
              setCopiedCypher(true);
              setTimeout(() => setCopiedCypher(false), 1500);
            }}
          >
            {copiedCypher ? <Check size={11} /> : <ExternalLink size={11} />}
            <span>{copiedCypher ? 'Copied' : 'Copy Cypher'}</span>
          </button>
        </div>
      </details>

      <details className="accordion-item">
        <summary className="accordion-header">
          <span><Database size={13} /> Query diagnostics</span>
          <ChevronDown size={12} className="accordion-chevron" />
        </summary>
        <div className="accordion-content diagnostics-grid">
          <div><span>GRAPH ENGINE</span><b>FalkorDB</b></div>
          <div><span>IDENTITY</span><b>{currentRole.name}</b></div>
          <div><span>PERMISSIONS</span><b>{currentRole.team}</b></div>
        </div>
      </details>
    </div>
  </aside>;
}

function AnswerDock({ activeScenario, latestAnswer }) {
  return <section className="answer-dock panel">
    <div className="answer-badge">
      <BrainCircuit size={12} />
      <span>SYNTHESIS</span>
    </div>
    <div className="answer-content">
      <div className="answer-text">
        {latestAnswer?.answer || activeScenario.answer}
      </div>
    </div>
    <div className="answer-meta">
      <span className="grounded-pill">
        <ShieldCheck size={12} /> {activeScenario.path.length} hops grounded
      </span>
    </div>
  </section>;
}

function OperationalWorkspace({ onBackHome, initialScenarioId }) {
  const [currentRole, setCurrentRole] = useState(roles.kabir);
  const [activeScenarioId, setActiveScenarioId] = useState(initialScenarioId || 'rootcause');
  const [staleByScenario, setStaleByScenario] = useState({});
  const [runtimeByScenario, setRuntimeByScenario] = useState({});
  const [companyGraph, setCompanyGraph] = useState(initialMockGraph);
  const [backendMode, setBackendMode] = useState('mock');
  const [feed, setFeed] = useState(initialFeed);
  const [focusedNode, setFocusedNode] = useState('user-meera');
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredHopIndex, setHoveredHopIndex] = useState(null);
  const [animatingHopIndex, setAnimatingHopIndex] = useState(0);
  const [revealedHopCount, setRevealedHopCount] = useState(1);
  const [animationTick, setAnimationTick] = useState(0);
  const [graphFilter, setGraphFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [asking, setAsking] = useState(false);
  const [running, setRunning] = useState(false);
  const [latestAnswer, setLatestAnswer] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchCompanyGraph().then((liveGraph) => {
      if (cancelled || !liveGraph) return;
      setCompanyGraph(liveGraph);
      setBackendMode('live');
      setToast('Connected to FastAPI · live company graph loaded');
      window.setTimeout(() => setToast(''), 2400);
    });
    return () => { cancelled = true; };
  }, []);

  const activeScenario = useMemo(() => {
    const scenario = scenarios[activeScenarioId];
    const runtime = runtimeByScenario[activeScenarioId];
    const merged = {
      ...scenario,
      ...(runtime || {}),
      stale: staleByScenario[activeScenarioId] ?? scenario.stale,
      path: runtime?.path || scenario.path,
      hops: runtime?.hops || scenario.hops,
      cypher: runtime?.cypher || scenario.cypher,
    };
    if (activeScenarioId === 'access' && currentRole.id === 'dev' && !runtime) {
      return {
        ...merged, severity: 'AUTHORIZED', blocked: false,
        title: 'Authorized admin path reaches payout data',
        summary: 'Dev is an Operations Admin. The graph confirms a valid administrative path to the restricted payout ledger; the data shown is synthetic.',
        answer: 'Authorized for this role. Dev’s Operations Admin access path reaches the Rider Payout Ledger. In production, the backend must still apply field-level policy before returning confidential formula details.',
        path: ['user-dev', 'team-ops', 'sys-payout', 'doc-04'],
        hops: [
          { id: 'user-dev', relation: 'MEMBER_OF', title: 'Dev Malhotra · Operations Admin', detail: 'The request is evaluated under the caller’s current identity.', kind: 'Person' },
          { id: 'team-ops', relation: 'ADMIN_ACCESS', title: 'Operations Team', detail: 'This team has the required administrative relationship.', kind: 'Team' },
          { id: 'sys-payout', relation: 'DOCUMENTS', title: 'Rider Payout Ledger', detail: 'The authorized path reaches the restricted system node.', kind: 'System' },
          { id: 'doc-04', relation: 'AUTHORIZED CONTEXT', title: 'Rider Spillover Formula', detail: 'Synthetic restricted documentation is reachable for this admin role.', kind: 'Doc' },
        ],
        cypher: "MATCH (u:Person {id:'user-dev'})-[:MEMBER_OF]->(t:Team)-[:ADMIN_ACCESS]->(s:System {id:'sys-payout'})\nMATCH (s)<-[:DOCUMENTS]-(d:Doc {id:'doc-04'})\nRETURN u, t, s, d",
      };
    }
    return merged;
  }, [activeScenarioId, staleByScenario, runtimeByScenario, currentRole]);

  async function runScenario(id) {
    if (running) return;
    setRunning(true);
    setActiveScenarioId(id);
    setGraphFilter('all');
    setLatestAnswer(null);
    setHoveredNode(null);
    setHoveredHopIndex(null);
    setAnimationTick((t) => t + 1);
    const scenario = scenarios[id];
    setFocusedNode(id === 'access' && currentRole.id === 'dev' ? 'user-dev' : scenario.path[0]);
    try {
      const result = await runCompanyScenario(scenario, currentRole);
      if (result.graphData) setCompanyGraph(result.graphData);
      setBackendMode(result.backendMode);
      setStaleByScenario((old) => ({ ...old, [id]: result.staleDocs }));
      if (result.runtime) setRuntimeByScenario((old) => ({ ...old, [id]: result.runtime }));
      else setRuntimeByScenario((old) => ({ ...old, [id]: null }));
      const newFeed = result.feedItem;
      setFeed((old) => [newFeed, ...old].slice(0, 7));
      setToast(result.backendMode === 'live' ? `${scenario.short} executed against FalkorDB` : `${scenario.short} · deterministic demo mode`);
      window.setTimeout(() => setToast(''), 2400);
    } finally {
      setRunning(false);
    }
  }

  function changeRole(role) {
    setCurrentRole(role);
    setLatestAnswer(null);
    setHoveredNode(null);
    setHoveredHopIndex(null);
    setRuntimeByScenario((old) => ({ ...old, access: null }));
    setAnimationTick((t) => t + 1);
    if (activeScenarioId === 'access') setFocusedNode(role.id === 'dev' ? 'user-dev' : 'user-kabir');
  }

  async function onAsk() {
    if (!query.trim() || asking) return;
    setAsking(true);
    try {
      const response = await askCompanyBrain(query, activeScenario);
      setLatestAnswer(response);
      setFocusedNode(response?.path?.[0] || activeScenario.path[0]);
      setAnimationTick((t) => t + 1);
      setToast(backendMode === 'live' ? 'Question answered from the selected trace context' : 'Demo answer traced to the selected scenario');
      window.setTimeout(() => setToast(''), 2200);
    } finally { setAsking(false); }
  }

  useEffect(() => {
    function onKey(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector('.assistant-input input')?.focus();
      }
      if (event.key === 'Escape') setToast('');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (initialScenarioId && scenarios[initialScenarioId]) {
      runScenario(initialScenarioId);
    }
  }, [initialScenarioId]);

  return <div className="app-shell">
    <AppRail onBackHome={onBackHome} />
    <div className="app-frame">
    <Header
      currentRole={currentRole}
      setCurrentRole={changeRole}
      backendMode={backendMode}
      onBackHome={onBackHome}
    />
    <div className="app-body">
    <main className="main-content">
      <OverviewHeader currentRole={currentRole} />
      <DecisionCards activeScenario={activeScenario} runScenario={runScenario} />
      <div className="section-label-row graph-label-row">
        <span className="section-label">COMPANY GRAPH</span>
        <span className="section-label muted">{activeScenario.eyebrow}</span>
      </div>
        <CompanyGraph
          companyNodes={companyGraph.nodes}
          companyLinks={companyGraph.links}
          activeScenario={activeScenario}
          staleDocs={activeScenario.stale}
          currentRole={currentRole}
          focusedNode={focusedNode}
          setFocusedNode={setFocusedNode}
          hoveredNode={hoveredNode}
          setHoveredNode={setHoveredNode}
          hoveredHopIndex={hoveredHopIndex}
          setHoveredHopIndex={setHoveredHopIndex}
          animatingHopIndex={animatingHopIndex}
          setAnimatingHopIndex={setAnimatingHopIndex}
          revealedHopCount={revealedHopCount}
          setRevealedHopCount={setRevealedHopCount}
          animationTick={animationTick}
          setAnimationTick={setAnimationTick}
          graphFilter={graphFilter}
          setGraphFilter={setGraphFilter}
          backendMode={backendMode}
        />
      <PulseFeed feed={feed} />
      <footer className="app-footer"><div><span className="footer-brand-mark"><BrandGlyph /></span><span>BLINKBRAIN</span><span className="footer-copy-divider">·</span><span>WE MAKE DEVS HACKATHON BUILD</span></div><div><span>{backendMode === 'live' ? 'LIVE FALKORDB DATA' : 'SIMULATED COMPANY DATA'}</span><span className="footer-copy-divider">·</span><span className="footer-ready"><i /> SYSTEM READY</span></div></footer>
    </main>
    <AssistantPanel
      activeScenario={activeScenario}
      query={query}
      setQuery={setQuery}
      onAsk={onAsk}
      asking={asking}
      latestAnswer={latestAnswer}
      inspector={<XRayInspector
          activeScenario={activeScenario}
          focusedNode={focusedNode}
          setFocusedNode={setFocusedNode}
          hoveredNode={hoveredNode}
          setHoveredNode={setHoveredNode}
          hoveredHopIndex={hoveredHopIndex}
          setHoveredHopIndex={setHoveredHopIndex}
          animatingHopIndex={animatingHopIndex}
          revealedHopCount={revealedHopCount}
          companyNodes={companyGraph.nodes}
          staleDocs={activeScenario.stale}
          currentRole={currentRole}
          runScenario={runScenario}
        />}
    />
    </div>
    </div>
    {toast && <div className="toast"><CheckCircle2 size={15} />{toast}</div>}
  </div>;
}

function getInitialRoute() {
  if (typeof window === 'undefined') return { route: 'landing', scenarioId: null };
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  if (path === '/app' || path.startsWith('/app/') || hash === '#app' || hash.startsWith('#app')) {
    const params = new URLSearchParams(window.location.search);
    return { route: 'app', scenarioId: params.get('scenario') || null };
  }
  return { route: 'landing', scenarioId: null };
}

export default function App() {
  const [navState, setNavState] = useState(getInitialRoute);

  useEffect(() => {
    const handlePopState = () => {
      setNavState(getInitialRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = useCallback((route, scenarioId = null) => {
    const targetPath = route === 'app'
      ? (scenarioId ? `/app?scenario=${scenarioId}` : '/app')
      : '/';
    try {
      window.history.pushState({ route, scenarioId }, '', targetPath);
    } catch {
      // In case of restricted environment
      window.location.hash = route === 'app' ? (scenarioId ? `#app?scenario=${scenarioId}` : '#app') : '#';
    }
    setNavState({ route, scenarioId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (navState.route === 'app') {
    return (
      <OperationalWorkspace
        onBackHome={() => navigateTo('landing')}
        initialScenarioId={navState.scenarioId}
      />
    );
  }

  return (
    <LandingPage
      onLaunchDemo={(scenarioId) => navigateTo('app', scenarioId)}
    />
  );
}

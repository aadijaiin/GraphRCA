import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import {
  Play, Pause, RotateCcw, ChevronRight, ChevronDown, Check, CheckCircle2,
  Cpu, Sparkles, Terminal, ArrowRight, Clock, Database, Layers,
  Activity, ArrowUpRight, ShieldCheck, ShieldAlert
} from 'lucide-react';
import Container from './ui/Container.jsx';
import Section from './ui/Section.jsx';
import SectionIndex from './ui/SectionIndex.jsx';
import CornerTicks from './ui/CornerTicks.jsx';
import Button from './ui/Button.jsx';
import { nodes as mockNodes, links as mockLinks } from '../data/mockCompany.js';

// -------------------------------------------------------------
// OBSIDIAN CANVAS 3D SPHERE THEMES (Restrained Editorial Palette)
// -------------------------------------------------------------
// Flat ink-on-cream palette shared with the hero and /app graph
const SPHERE_THEMES = {
  system: { light: '#1a1614', base: '#1a1614', shadow: '#1a1614', rim: '#1a1614', glow: 'rgba(232, 98, 43, 0.22)', labelAccent: '#1a1614' },
  decisionActive: { light: '#7d8a24', base: '#7d8a24', shadow: '#7d8a24', rim: '#7d8a24', glow: 'rgba(125, 138, 36, 0.24)', labelAccent: '#5f6a17' },
  ticket: { light: '#e8622b', base: '#e8622b', shadow: '#e8622b', rim: '#e8622b', glow: 'rgba(232, 98, 43, 0.26)', labelAccent: '#c4561f' },
  doc: { light: '#7f6cc4', base: '#7f6cc4', shadow: '#7f6cc4', rim: '#7f6cc4', glow: 'rgba(127, 108, 196, 0.22)', labelAccent: '#634fa8' },
  silverWhite: { light: '#6e6a63', base: '#6e6a63', shadow: '#6e6a63', rim: '#6e6a63', glow: 'rgba(110, 106, 99, 0.2)', labelAccent: '#1a1614' },
  restricted: { light: '#c8382d', base: '#c8382d', shadow: '#c8382d', rim: '#c8382d', glow: 'rgba(200, 56, 45, 0.26)', labelAccent: '#c8382d' },
};

function getNodeTheme(node) {
  if (node.type === 'Doc') return SPHERE_THEMES.doc;
  if (node.type === 'Decision') return SPHERE_THEMES.decisionActive;
  if (node.type === 'System') return node.restricted ? SPHERE_THEMES.restricted : SPHERE_THEMES.system;
  if (node.type === 'Ticket') return SPHERE_THEMES.ticket;
  return SPHERE_THEMES.silverWhite;
}

function pairKey(a, b) {
  const sA = typeof a === 'object' ? a?.id : a;
  const sB = typeof b === 'object' ? b?.id : b;
  return [String(sA), String(sB)].sort().join('::');
}

// -------------------------------------------------------------
// 5 SPECIALIZED CAPABILITIES (Left Editorial Stack)
// -------------------------------------------------------------
const CAPABILITIES = [
  {
    id: 'root-cause',
    num: '01',
    category: 'WHY DID IT BREAK',
    name: 'Root Cause',
    description: 'Starts from what’s failing and walks back through systems and tickets to what actually broke.',
    stageIndex: 1, // Relevant graph paths traversed
    targetNodes: ['sys-inv', 'LIN-101'],
  },
  {
    id: 'impact-analysis',
    num: '02',
    category: 'WHAT ELSE IS HIT',
    name: 'Impact Analysis',
    description: 'Shows who and what is affected next: orders, campaigns, riders and partner promises.',
    stageIndex: 4, // Business impact identified
    targetNodes: ['doc-02', 'user-meera', 'sys-inv'],
  },
  {
    id: 'smart-delegation',
    num: '03',
    category: 'WHO SHOULD FIX IT',
    name: 'Smart Delegation',
    description: 'Sends the fix to the person who owns the system, or who solved the same problem last time.',
    stageIndex: 5, // Action proposed
    targetNodes: ['user-meera', 'user-dev', 'team-mkt', 'team-ops'],
  },
  {
    id: 'knowledge-maintenance',
    num: '04',
    category: 'WHAT IS OUT OF DATE',
    name: 'Knowledge Maintenance',
    description: 'Flags runbooks and SLAs that still describe a rule that has since changed.',
    stageIndex: 3, // Evidence assembled
    targetNodes: ['LIN-101', 'sys-inv', 'doc-02'],
  },
  {
    id: 'access-control',
    num: '05',
    category: 'WHO MAY SEE IT',
    name: 'Access Control',
    description: 'Checks your role on every step, so private data like payouts never reaches the answer.',
    stageIndex: 2, // Permissions validated
    targetNodes: ['user-meera', 'team-mkt', 'sys-inv', 'sys-payout'],
  },
];

// -------------------------------------------------------------
// 7-STAGE EXPLAINABLE WORKFLOW (INC-849 Quick-Commerce Incident)
// -------------------------------------------------------------
const WORKFLOW_STAGES = [
  {
    index: 0,
    number: '01',
    name: 'Event detected',
    short: 'Event',
    status: 'RUNNING',
    badge: 'TELEMETRY ANOMALY',
    tool: 'telemetry.ingest_iot_alert(sensor="frz-04", store="delhi-04")',
    duration: '1.2ms',
    summary: 'A freezer at South Delhi store #4 goes above its safe temperature, and the sensor raises an alert.',
    activeNodes: ['sys-inv', 'LIN-101'],
    activeEdges: [['LIN-101', 'sys-inv']],
    evidence: [
      { id: 'sys-inv', label: 'NCR Freezer Sync', type: 'System', role: 'Affected Service', detail: 'Dark-store capacity throttled to 12%' },
      { id: 'LIN-101', label: 'LIN-101 Freezer Outage', type: 'Ticket', role: 'Telemetry Alert', detail: 'Breaker tripped at South Delhi #04' },
    ],
  },
  {
    index: 1,
    number: '02',
    name: 'Relevant graph paths traversed',
    short: 'Traversal',
    status: 'RUNNING',
    badge: 'CAUSALITY DISCOVERY',
    tool: 'falkordb.cypher_traverse(depth=3, directed=false)',
    duration: '4.8ms',
    summary: 'The agent follows the graph out from the freezer system and finds an ice-cream campaign that depends on that stock.',
    activeNodes: ['sys-inv', 'doc-02', 'user-meera', 'team-mkt'],
    activeEdges: [['doc-02', 'sys-inv'], ['team-mkt', 'doc-02'], ['user-meera', 'team-mkt']],
    evidence: [
      { id: 'doc-02', label: 'Amul Ice-Cream Flash Ad', type: 'Doc', role: 'Downstream Consumer', detail: 'Push notification scheduled in 15 mins' },
      { id: 'user-meera', label: 'Meera Nair · Growth', type: 'Person', role: 'Campaign Owner', detail: 'Marketing Manager for NCR Region' },
    ],
  },
  {
    index: 2,
    number: '03',
    name: 'Permissions validated',
    short: 'Perms',
    status: 'RUNNING',
    badge: 'POLICY EVALUATION',
    tool: 'auth.evaluate_rbac_policy(caller="user-meera", scope="operations")',
    duration: '0.9ms',
    summary: 'It checks what the person asking is allowed to see. Inventory is fine for Marketing; payout data stays hidden.',
    activeNodes: ['user-meera', 'team-mkt', 'sys-inv', 'sys-payout'],
    activeEdges: [['team-mkt', 'sys-inv'], ['team-ops', 'sys-payout']],
    evidence: [
      { id: 'user-meera', label: 'Meera Nair · Marketing', type: 'Person', role: 'Standard Access', detail: 'Authorized for Store & Inventory state' },
      { id: 'sys-payout', label: 'Rider Payout Ledger', type: 'System', role: 'Security Boundary', detail: '403 Forbidden · Ledger masked' },
    ],
  },
  {
    index: 3,
    number: '04',
    name: 'Evidence assembled',
    short: 'Evidence',
    status: 'RUNNING',
    badge: 'EVIDENCE COLLECTED',
    tool: 'graph.collect_path(ids=["LIN-101", "sys-inv", "doc-02"])',
    duration: '3.1ms',
    summary: 'It collects the exact nodes on the path: the outage ticket, the freezer system and the campaign plan.',
    activeNodes: ['LIN-101', 'sys-inv', 'doc-02'],
    activeEdges: [['LIN-101', 'sys-inv'], ['doc-02', 'sys-inv']],
    evidence: [
      { id: 'LIN-101', label: 'LIN-101 Ticket', type: 'Ticket', role: 'Root Cause', detail: 'Freezer capacity throttled to 12%' },
      { id: 'doc-02', label: 'Campaign Plan DOC-02', type: 'Doc', role: 'Violated Precondition', detail: 'Clause 4.2 requires >80% store readiness' },
    ],
  },
  {
    index: 4,
    number: '05',
    name: 'Business impact identified',
    short: 'Impact',
    status: 'RUNNING',
    badge: 'IMPACT ASSESSMENT',
    tool: 'impact.simulate_blast_radius(campaign="amul-flash", store="delhi-04")',
    duration: '2.4ms',
    summary: 'It sizes the impact: 12,400 customers are about to get a push for ice cream the store can’t deliver.',
    activeNodes: ['doc-02', 'user-meera', 'sys-inv'],
    activeEdges: [['doc-02', 'sys-inv'], ['team-mkt', 'doc-02']],
    evidence: [
      { id: 'doc-02', label: '12,400 Push Notifications', type: 'Doc', role: 'Imminent Blast', detail: 'Scheduled in 12 mins' },
      { id: 'sys-inv', label: '84% SLA Breach Risk', type: 'System', role: 'Projected Fallout', detail: '₹2.4L ad budget wasted' },
    ],
  },
  {
    index: 5,
    number: '06',
    name: 'Action proposed',
    short: 'Action',
    status: 'RUNNING',
    badge: 'MITIGATION PROPOSAL',
    tool: 'agent.propose_mitigation(confidence=0.98, urgency="IMMEDIATE")',
    duration: '1.8ms',
    summary: 'It proposes a fix: pause the push, tell Meera (campaign owner), and ask Dev (ops) to restock from the backup store.',
    activeNodes: ['user-meera', 'team-mkt', 'user-dev', 'team-ops'],
    activeEdges: [['user-meera', 'team-mkt'], ['user-dev', 'team-ops']],
    evidence: [
      { id: 'user-meera', label: 'Pause Push Campaign', type: 'Person', role: 'Automated Action', detail: 'Stop dispatch to Delhi-04 zone' },
      { id: 'user-dev', label: 'Notify Ops Lead Dev', type: 'Person', role: 'Dispatch Reroute', detail: 'Switch inventory to South Delhi hub' },
    ],
  },
  {
    index: 6,
    number: '07',
    name: 'Outcome verified or blocked',
    short: 'Verified',
    status: 'COMPLETED',
    badge: 'GROUNDED IN GRAPH',
    tool: 'graph.write_decision(trace="INC-849", path_len=5)',
    duration: '11.4ms',
    summary: 'The push is held, cancellations are avoided, and the decision and its path are written back to the graph.',
    activeNodes: ['LIN-101', 'sys-inv', 'doc-02', 'user-meera', 'user-dev'],
    activeEdges: [['LIN-101', 'sys-inv'], ['doc-02', 'sys-inv'], ['user-meera', 'team-mkt'], ['user-dev', 'team-ops']],
    evidence: [
      { id: 'LIN-101', label: '12,400 Orders Protected', type: 'Ticket', role: 'Verified Outcome', detail: 'Push notification safely withheld' },
      { id: 'doc-02', label: 'Decision written back', type: 'Doc', role: 'Audit trail', detail: 'Path + Cypher stored on INC-849' },
    ],
  },
];

/**
 * SpecializedAgentsSection
 * Implementation of Prompt 6:
 * - Two-column editorial composition
 * - Left column:
 *   - Serif headline: "One company brain. An entire team of agents."
 *   - Restrained supporting copy
 *   - Vertical stack of 5 capability panels (Root Cause, Impact Analysis, Smart Delegation, Knowledge Maintenance, Access Control)
 *   - Monospace uppercase category labels, thin dashed borders, corner ticks, dark charcoal active state
 * - Right column:
 *   - Large dark technical radial graph visualization using react-force-graph-2d
 *   - Restrained sphere nodes, fine edges, subtle ambient movement, directional particles
 *   - 7-stage synchronized explainable workflow demonstration
 *   - Replay, Pause, and Step-through controls (~12-14s timing)
 *   - Fully responsive, accessible, zero horizontal overflow
 */
export default function SpecializedAgentsSection({ onLaunchDemo }) {
  const [activeCapabilityId, setActiveCapabilityId] = useState('root-cause');
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [hoveredEvidenceId, setHoveredEvidenceId] = useState(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 620, height: 440 });

  const fgRef = useRef(null);
  const graphContainerRef = useRef(null);
  const autoPlayTimerRef = useRef(null);
  const prefersReducedMotionRef = useRef(false);

  const currentStage = WORKFLOW_STAGES[currentStageIndex];

  // Check reduced motion preference
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      prefersReducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }, []);

  // Update graph container dimensions
  useEffect(() => {
    function updateDims() {
      if (graphContainerRef.current) {
        const w = graphContainerRef.current.clientWidth;
        const h = Math.max(340, Math.min(480, Math.round(w * 0.68)));
        setGraphDimensions({ width: w, height: h });
      }
    }
    updateDims();
    window.addEventListener('resize', updateDims);
    return () => window.removeEventListener('resize', updateDims);
  }, []);

  // Physics simulation tuning
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force?.('charge')?.strength?.(-130)?.distanceMax?.(360);
    fg.d3Force?.('link')?.distance?.(68)?.strength?.(0.38);
    fg.d3ReheatSimulation?.();
  }, []);

  // Graph data and active lookup sets
  const graphData = useMemo(() => {
    return {
      nodes: mockNodes.map((n) => ({ ...n })),
      links: mockLinks.map(([source, target, label]) => ({ source, target, label })),
    };
  }, []);

  // Centre and zoom the camera on this stage's nodes using live simulation positions
  const focusActiveNodes = useCallback((ms) => {
    const fg = fgRef.current;
    if (!fg) return;
    const ids = new Set(currentStage.activeNodes);
    const pts = graphData.nodes.filter((n) => ids.has(n.id) && Number.isFinite(n.x) && Number.isFinite(n.y));
    if (pts.length === 0) return;
    const xs = pts.map((n) => n.x);
    const ys = pts.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 70;
    const k = Math.min(
      graphDimensions.width / (maxX - minX + pad * 2),
      graphDimensions.height / (maxY - minY + pad * 2),
    );
    const duration = prefersReducedMotionRef.current ? 0 : ms;
    // Zoom instantly, then animate only the pan: two animated camera calls interrupt each other
    fg.zoom?.(Math.max(0.6, Math.min(1.8, k)), 0);
    fg.centerAt?.((minX + maxX) / 2, (minY + maxY) / 2, duration);
  }, [currentStage.activeNodes, graphData, graphDimensions]);

  // Center camera on active nodes when stage changes
  useEffect(() => {
    if (!fgRef.current) return undefined;

    focusActiveNodes(600);
    // Re-centre once more after the simulation has nudged positions
    const settleTimer = window.setTimeout(() => focusActiveNodes(400), 700);
    return () => window.clearTimeout(settleTimer);
  }, [currentStageIndex, currentStage.activeNodes, graphData, graphDimensions]);

  // Sequential workflow playback timer (~1.9s per stage = ~13.3s total)
  useEffect(() => {
    if (!isPlaying || prefersReducedMotionRef.current) {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      return;
    }

    const intervalMs = Math.round(1900 / playbackSpeed);
    autoPlayTimerRef.current = setInterval(() => {
      setCurrentStageIndex((prev) => {
        if (prev >= WORKFLOW_STAGES.length - 1) {
          // Loop back to start after a clean pause
          return 0;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  // Sync left capability panel with current stage during auto-play
  useEffect(() => {
    const matchingCap = CAPABILITIES.find((c) => c.stageIndex === currentStageIndex);
    if (matchingCap) {
      setActiveCapabilityId(matchingCap.id);
    }
  }, [currentStageIndex]);

  // Handle clicking a capability panel on the left
  const handleSelectCapability = (cap) => {
    setActiveCapabilityId(cap.id);
    setCurrentStageIndex(cap.stageIndex);
    setIsPlaying(false); // Pause on user selection so they can inspect
  };

  // Playback control handlers
  const handleTogglePlay = () => setIsPlaying((p) => !p);
  const handleReplay = () => {
    setCurrentStageIndex(0);
    setIsPlaying(true);
  };
  const handleStepPrev = () => {
    setIsPlaying(false);
    setCurrentStageIndex((prev) => Math.max(0, prev - 1));
  };
  const handleStepNext = () => {
    setIsPlaying(false);
    setCurrentStageIndex((prev) => Math.min(WORKFLOW_STAGES.length - 1, prev + 1));
  };
  const toggleSpeed = () => {
    setPlaybackSpeed((curr) => (curr === 1 ? 1.5 : curr === 1.5 ? 2 : 1));
  };


  const activeNodeSet = useMemo(() => new Set(currentStage.activeNodes), [currentStage.activeNodes]);
  const activeEdgePairs = useMemo(() => {
    const pairs = new Set();
    currentStage.activeEdges.forEach(([s, t]) => pairs.add(pairKey(s, t)));
    return pairs;
  }, [currentStage.activeEdges]);

  // Canvas paint logic for nodes
  const paintNode = useCallback((node, ctx, globalScale) => {
    const isActive = activeNodeSet.has(node.id);
    const isHovered = hoveredEvidenceId === node.id;
    const theme = getNodeTheme(node);

    let r = node.type === 'Team' ? 8.2 : node.type === 'System' ? 7.6 : 6.5;
    if (isActive) r *= 1.25;
    if (isHovered) r *= 1.35;

    ctx.save();
    // Dim inactive nodes
    ctx.globalAlpha = isActive || isHovered ? 1.0 : 0.28;

    // Glowing halo on active or hovered nodes
    if (isActive || isHovered) {
      const glowR = r + (isHovered ? 12 : 8.5);
      const glowGrad = ctx.createRadialGradient(node.x, node.y, r * 0.7, node.x, node.y, glowR);
      glowGrad.addColorStop(0, theme.glow);
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      // Sharp outer accent ring
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 2.6, 0, Math.PI * 2);
      ctx.strokeStyle = isHovered ? '#e8622b' : theme.base;
      ctx.lineWidth = 1.2 / Math.max(globalScale, 0.6);
      ctx.stroke();
    }

    // 3D Sphere Body
    const lightX = node.x - r * 0.32;
    const lightY = node.y - r * 0.32;
    const sphereGrad = ctx.createRadialGradient(lightX, lightY, r * 0.08, node.x, node.y, r);
    sphereGrad.addColorStop(0, theme.light);
    sphereGrad.addColorStop(0.45, theme.base);
    sphereGrad.addColorStop(0.85, theme.shadow);
    sphereGrad.addColorStop(1, theme.rim);

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.fillStyle = sphereGrad;
    ctx.fill();

    // Specular highlight
    const specGrad = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, r * 0.45);
    specGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.beginPath();
    ctx.arc(lightX, lightY, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = specGrad;
    ctx.fill();

    // Labels for active / hovered nodes
    if (isActive || isHovered || globalScale > 1.25) {
      const fontSize = Math.max(9, Math.min(12, 10 / globalScale));
      ctx.font = `400 ${fontSize}px "Geist Mono", "DM Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const label = node.label || node.id;
      const textY = node.y + r + 4;
      const textW = ctx.measureText(label).width;

      ctx.fillStyle = 'rgba(253, 253, 250, 0.95)';
      ctx.fillRect(node.x - textW / 2 - 4, textY - 2, textW + 8, fontSize + 5);
      ctx.strokeStyle = 'rgba(26, 22, 20, 0.14)';
      ctx.lineWidth = 0.6 / Math.max(globalScale, 0.6);
      ctx.strokeRect(node.x - textW / 2 - 4, textY - 2, textW + 8, fontSize + 5);

      ctx.fillStyle = isHovered ? '#c4561f' : theme.labelAccent;
      ctx.fillText(label, node.x, textY);
    }

    ctx.restore();
  }, [activeNodeSet, hoveredEvidenceId]);

  // Link styling & directional particles
  const isEdgeActive = useCallback((link) => {
    const sId = typeof link.source === 'object' ? link.source.id : link.source;
    const tId = typeof link.target === 'object' ? link.target.id : link.target;
    return activeEdgePairs.has(pairKey(sId, tId));
  }, [activeEdgePairs]);

  const getLinkColor = useCallback((link) => {
    return isEdgeActive(link) ? 'rgba(232, 98, 43, 0.9)' : 'rgba(26, 22, 20, 0.12)';
  }, [isEdgeActive]);

  const getLinkWidth = useCallback((link) => {
    return isEdgeActive(link) ? 2 : 0.8;
  }, [isEdgeActive]);

  const getLinkParticles = useCallback((link) => {
    return isEdgeActive(link) ? 3 : 0;
  }, [isEdgeActive]);

  return (
    <Section className="bb-agents-section" id="agents" spacing="default">
      <Container className="bb-agents-container">
        {/* Section Index Header */}
        <div className="bb-agents-header-row">
          <SectionIndex number="04" label="SPECIALIZED REASONING" />
          <span className="bb-agents-header-tag">WHAT THE AGENTS DO</span>
        </div>

        {/* Two-Column Editorial Composition */}
        <div className="bb-agents-two-col-grid">
          {/* =========================================================
              LEFT COLUMN: Editorial Intro & 5 Vertical Capability Panels
              ========================================================= */}
          <div className="bb-agents-left-col">
            <h2 className="bb-agents-headline">
              One graph.<br />
              <span className="bb-headline-italic">Five jobs it does for you.</span>
            </h2>

            <p className="bb-agents-copy">
              Each agent reads the same company graph. Pick one to watch it work through a
              real incident, step by step, with the graph lighting up as it goes.
            </p>

            {/* Vertical Stack of Capability Panels */}
            <div className="bb-capabilities-stack" role="tablist" aria-label="Agent Capabilities">
              {CAPABILITIES.map((cap) => {
                const isSelected = activeCapabilityId === cap.id;

                return (
                  <button
                    key={cap.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={`bb-capability-panel ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelectCapability(cap)}
                  >
                    <CornerTicks
                      strokeColor={isSelected ? 'rgba(255, 255, 255, 0.35)' : 'rgba(23, 21, 19, 0.25)'}
                      size={8}
                    />

                    <div className="bb-cap-panel-header">
                      <span className="bb-cap-category">{cap.category}</span>
                      <span className="bb-cap-num">[{cap.num}]</span>
                    </div>

                    <h3 className="bb-cap-name">{cap.name}</h3>
                    <p className="bb-cap-desc">{cap.description}</p>

                    <div className="bb-cap-panel-footer">
                      <span className="bb-cap-action-cue">
                        {isSelected ? 'ACTIVE IN DEMO' : 'CLICK TO SPOTLIGHT'}
                      </span>
                      <ChevronRight size={13} className="bb-cap-chevron" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* =========================================================
              RIGHT COLUMN: Technical Radial Graph & 7-Stage Workflow
              ========================================================= */}
          <div className="bb-agents-right-col">
            <div className="bb-agents-graph-card">
              <CornerTicks strokeColor="rgba(255, 255, 255, 0.18)" size={10} />

              {/* Technical Card Top Bar: Status & Playback Controls */}
              <div className="bb-graph-card-topbar">
                <div className="bb-graph-top-info">
                  <span className="bb-graph-live-dot" />
                  <span className="bb-graph-trace-title">
                    DEMO INCIDENT · FREEZER OUTAGE
                  </span>
                </div>

                {/* Control Action Buttons */}
                <div className="bb-workflow-controls">
                  <button
                    type="button"
                    className="bb-ctrl-btn"
                    onClick={handleTogglePlay}
                    title={isPlaying ? 'Pause demonstration' : 'Resume demonstration'}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                  </button>

                  <button
                    type="button"
                    className="bb-ctrl-btn"
                    onClick={handleStepPrev}
                    disabled={currentStageIndex === 0}
                    title="Previous step"
                    aria-label="Previous step"
                  >
                    ◀
                  </button>

                  <button
                    type="button"
                    className="bb-ctrl-btn"
                    onClick={handleStepNext}
                    disabled={currentStageIndex === WORKFLOW_STAGES.length - 1}
                    title="Next step"
                    aria-label="Next step"
                  >
                    ▶
                  </button>

                  <button
                    type="button"
                    className="bb-ctrl-btn"
                    onClick={handleReplay}
                    title="Restart workflow from Stage 1"
                    aria-label="Restart"
                  >
                    <RotateCcw size={12} />
                  </button>

                  <button
                    type="button"
                    className="bb-speed-pill"
                    onClick={toggleSpeed}
                    title="Change playback speed"
                  >
                    {playbackSpeed}x
                  </button>
                </div>
              </div>

              {/* Sequential 7-Stage Execution Rail (Beautiful UI Pattern) */}
              <div className="bb-stages-rail" role="tablist" aria-label="Workflow Stages">
                {WORKFLOW_STAGES.map((st, idx) => {
                  const isCurrent = idx === currentStageIndex;
                  const isPast = idx < currentStageIndex;

                  return (
                    <button
                      key={st.number}
                      type="button"
                      role="tab"
                      aria-selected={isCurrent}
                      className={`bb-rail-stage-btn ${isCurrent ? 'is-current' : ''} ${isPast ? 'is-past' : ''}`}
                      onClick={() => {
                        setCurrentStageIndex(idx);
                        setIsPlaying(false);
                      }}
                    >
                      <div className="bb-rail-top">
                        <span className="bb-rail-num">
                          {isPast ? <Check size={10} strokeWidth={3} /> : st.number}
                        </span>
                        <span className="bb-rail-label">{st.short}</span>
                      </div>
                      <div className="bb-rail-progress-track">
                        <div className="bb-rail-progress-bar" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ForceGraph2D Canvas Container */}
              <div className="bb-graph-canvas-wrap" ref={graphContainerRef}>
                {/* HUD Top Info: Node & Hop Counters */}
                <div className="bb-graph-hud top">
                  <div className="bb-hud-left">
                    <span className="bb-hud-dot" />
                    <span className="bb-hud-label">COMPANY GRAPH</span>
                  </div>
                  <div className="bb-hud-right">
                    <span>{currentStage.activeNodes.length} ACTIVE NODES</span>
                    <span className="bb-hud-sep">·</span>
                    <span>{currentStage.activeEdges.length} TRAVERSED HOPS</span>
                  </div>
                </div>

                <ForceGraph2D
                  ref={fgRef}
                  width={graphDimensions.width}
                  height={graphDimensions.height}
                  graphData={graphData}
                  backgroundColor="rgba(0, 0, 0, 0)"
                  nodeCanvasObject={paintNode}
                  nodeCanvasObjectMode={() => 'replace'}
                  linkColor={getLinkColor}
                  linkWidth={getLinkWidth}
                  linkDirectionalParticles={prefersReducedMotionRef.current ? 0 : getLinkParticles}
                  linkDirectionalParticleWidth={2.4}
                  linkDirectionalParticleSpeed={0.008}
                  linkDirectionalParticleColor={() => '#e8622b'}
                  cooldownTicks={120}
                  onEngineStop={() => focusActiveNodes(500)}
                  enableZoomInteraction={false}
                  enablePanInteraction={false}
                />

                {/* HUD Bottom Info: Active Provenance Hop Sequence */}
                <div className="bb-graph-hud bottom">
                  <div className="bb-active-hop-chain">
                    <span className="bb-hop-label">PATH</span>
                    <div className="bb-hop-tokens">
                      {currentStage.activeNodes.map((id, i) => (
                        <span key={id} className="bb-hop-token">
                          <code>{id}</code>
                          {i < currentStage.activeNodes.length - 1 && <span className="bb-hop-arrow">→</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Compact Execution Trace Details (Beautiful UI Trace Card) */}
              <div className="bb-stage-trace-box">
                {/* Stage Header & Tool Invocation */}
                <div className="bb-trace-header-row">
                  <div className="bb-trace-stage-meta">
                    <span className="bb-trace-stage-badge">{currentStage.badge}</span>
                    <span className="bb-trace-stage-status">
                      <span className={`bb-status-light ${currentStage.status.toLowerCase()}`} />
                      {currentStage.status}
                    </span>
                  </div>

                  <div className="bb-trace-latency">
                    <Clock size={11} />
                    <span>{currentStage.duration}</span>
                  </div>
                </div>

                {/* Full Stage Headline */}
                <h3 className="bb-trace-stage-title">
                  <span className="bb-trace-stage-num">{currentStage.number}. </span>
                  {currentStage.name}
                </h3>

                {/* Minimal Tool Call Label */}
                <div className="bb-tool-invocation-pill">
                  <Terminal size={12} className="bb-terminal-icon" />
                  <code className="bb-tool-command">{currentStage.tool}</code>
                </div>

                {/* Plain-English Incident Summary */}
                <p className="bb-trace-summary">{currentStage.summary}</p>

                {/* Source-Linked Evidence Grid (Spotlights graph nodes on hover) */}
                <div className="bb-trace-evidence-section">
                  <div className="bb-evidence-title-row">
                    <span className="bb-evidence-title">SOURCE-LINKED EVIDENCE</span>
                    <span className="bb-evidence-hint">Hover to spotlight node in graph</span>
                  </div>

                  <div className="bb-evidence-grid">
                    {currentStage.evidence.map((ev) => {
                      const isHovered = hoveredEvidenceId === ev.id;

                      return (
                        <div
                          key={ev.id}
                          className={`bb-evidence-card ${isHovered ? 'is-hovered' : ''}`}
                          onMouseEnter={() => setHoveredEvidenceId(ev.id)}
                          onMouseLeave={() => setHoveredEvidenceId(null)}
                        >
                          <div className="bb-ev-top">
                            <span className="bb-ev-type">{ev.type}</span>
                            <span className="bb-ev-role">{ev.role}</span>
                          </div>
                          <div className="bb-ev-label">{ev.label}</div>
                          <div className="bb-ev-detail">{ev.detail}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Action Strip */}
                <div className="bb-trace-action-footer">
                  <span className="bb-trace-disclaimer">
                    *Deterministic demonstration environment. Simulated graph traversal.
                  </span>

                  <button
                    type="button"
                    className="bb-trace-lab-btn"
                    onClick={() => {
                      if (onLaunchDemo) onLaunchDemo('rootcause');
                    }}
                    title="Open this scenario in the Explainability Lab"
                  >
                    <span>Open Full Investigation in Lab</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

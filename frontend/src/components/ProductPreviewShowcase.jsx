import React, { useState } from 'react';
import {
  LayoutGrid, Flame, Cpu, Network, ArrowRight, Search, Sparkles,
  Clock, AlertTriangle, CheckCircle2, FileText, Users, ExternalLink,
  ChevronRight, ArrowUpRight, ShieldCheck, Activity, Database
} from 'lucide-react';
import Container from './ui/Container.jsx';
import Section from './ui/Section.jsx';
import SectionIndex from './ui/SectionIndex.jsx';
import CornerTicks from './ui/CornerTicks.jsx';

/**
 * Deterministic simulated answers for the 3 assistant prompt suggestions
 */
const SIMULATED_ANSWERS = {
  "What's causing this incident?": {
    question: "What's causing this incident?",
    summary: "Root-cause identified: Hardware sensor failure triggered automated cold-chain quarantine.",
    path: ["SENSOR-FREEZER-04", "NCR-INVENTORY-SYNC", "COLD-CHAIN-POLICY-v2", "STORE-DELHI-04"],
    details: "Sensor telemetry on South Delhi Freezer #4 breached +8°C threshold at 12:41 PM. Automated safety policy v2.4 immediately quarantined 42 perishable dairy SKUs, which temporarily blocked picking queues for 18 active orders.",
    owner: "Dev Malhotra (VP Ops)",
    evidence: "Causal path verified across 4 hops · 0 ungrounded assertions",
    status: "Action Required: Reassign orders to Store-Delhi-02 or confirm freezer reset"
  },
  "What should Operations know?": {
    question: "What should Operations know?",
    summary: "Cross-department collision: Marketing surge discount conflicts with courier dispatch fee.",
    path: ["CAMPAIGN-MONSOON-RUSH", "DEC-104-SURGE-OVERRIDE", "DYNAMIC-PRICING-SERVICE", "RIDER-FLEET-DELHI"],
    details: "The 'Monsoon Rush' coupon introduced a 20% discount that overrides dynamic surge pricing in North NCR, reducing courier payout density by 18% during peak rainfall.",
    owner: "Priya Sharma (Growth) & Logistics Fleet",
    evidence: "Derived from Decision Record DEC-104 & Postgres pricing schema",
    status: "Recommended: Cap promotional discount during Level-2 rainfall alerts"
  },
  "Which documents are out of date?": {
    question: "Which documents are out of date?",
    summary: "2 operational runbooks deviate from running production services.",
    path: ["NOTION-STORE-OPS-RUNBOOK", "COLD-STORAGE-SOP-2025", "FALKDORB-GRAPH"],
    details: "1. 'Dark Store Emergency Escalation' runbook lists retired Slack channel #delhi-ops-urgent. 2. Cold storage SOP v1.9 specifies a 15-minute sensor grace period, whereas firmware v3.2 enforces an immediate 5-minute quarantine.",
    owner: "Infrastructure Guild & Dark Store Leads",
    evidence: "Synthesized from Notion API sync vs. active K8s service configs",
    status: "BlinkBrain Agent can open pull requests to sync documentation"
  }
};

/**
 * MiniGraphEvidencePreview
 * Lightweight SVG node-link representation showing the active causal path
 */
function MiniGraphEvidencePreview({ activePath = [] }) {
  const nodes = [
    { id: 'n1', label: 'FREEZER-04', type: 'system', x: 28, y: 38 },
    { id: 'n2', label: 'NCR SYNC', type: 'service', x: 105, y: 22 },
    { id: 'n3', label: 'POLICY-v2', type: 'document', x: 185, y: 44 },
    { id: 'n4', label: 'STORE-DELHI-04', type: 'darkstore', x: 265, y: 24 },
  ];

  return (
    <div className="bb-mini-graph-card">
      <div className="bb-mini-graph-header">
        <div className="bb-mini-graph-indicator">
          <span className="bb-dot-pulse" />
          <span>ANSWER PATH · 4 HOPS</span>
        </div>
        <span className="bb-mini-graph-meta">FALKORDB GRAPH</span>
      </div>

      <svg className="bb-mini-graph-svg" viewBox="0 0 300 70" role="img" aria-label="Evidence traversal path">
        {/* Connecting Traversal Edges */}
        <line x1="28" y1="38" x2="105" y2="22" stroke="#F26B32" strokeWidth="2" strokeDasharray="3 3" />
        <line x1="105" y1="22" x2="185" y2="44" stroke="#F26B32" strokeWidth="2" strokeDasharray="3 3" />
        <line x1="185" y1="44" x2="265" y2="24" stroke="#F26B32" strokeWidth="2" strokeDasharray="3 3" />

        {/* Nodes */}
        {nodes.map((node, i) => (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
            {/* Outer ring */}
            <circle cx="0" cy="0" r="10" fill="#FFFFFF" stroke="#F26B32" strokeWidth="1.8" />
            {/* Center dot */}
            <circle cx="0" cy="0" r="4.5" fill={i === 3 ? '#A99B16' : '#171513'} />
            {/* Label below node */}
            <text
              x="0"
              y="19"
              textAnchor="middle"
              fontFamily="var(--font-mono, 'DM Mono', monospace)"
              fontSize="8px"
              fontWeight="600"
              fill="#171513"
              letterSpacing="0.04em"
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/**
 * ProductPreviewShowcase
 * Implementation of Prompt 5:
 * - Near-black charcoal section background (#101216) with subtle grain texture
 * - Large desktop browser-window-style frame with centered title
 * - Three visual regions:
 *   1. Left sidebar with network mark & icons (Overview, Events, Agents, Company Graph)
 *   2. Main workspace with greeting, simulated cluster label, status, metric sparklines,
 *      "Needs your attention" cards (checkout/coupon, freezer/inventory), and event list
 *   3. Right assistant panel: "Ask anything about your company", 3 prompt suggestions,
 *      interactive input, and synthesized graph-grounded evidence response
 * - Fully responsive with no page overflow
 */
export default function ProductPreviewShowcase({ onLaunchDemo }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [queryText, setQueryText] = useState("What's causing this incident?");
  const [activeAnswer, setActiveAnswer] = useState(SIMULATED_ANSWERS["What's causing this incident?"]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Handle clicking a prompt suggestion
  const handleSelectPrompt = (promptText) => {
    setQueryText(promptText);
    setIsSynthesizing(true);
    setTimeout(() => {
      setActiveAnswer(SIMULATED_ANSWERS[promptText] || SIMULATED_ANSWERS["What's causing this incident?"]);
      setIsSynthesizing(false);
    }, 280);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!queryText.trim()) return;
    setIsSynthesizing(true);
    setTimeout(() => {
      // Find matching simulated answer or fallback
      const match = SIMULATED_ANSWERS[queryText] || SIMULATED_ANSWERS["What's causing this incident?"];
      setActiveAnswer(match);
      setIsSynthesizing(false);
    }, 280);
  };

  return (
    <Section className="bb-product-showcase-section" id="product-preview" spacing="none">
      <Container className="bb-product-showcase-container">
        {/* Section Header with Refined Research Aesthetics */}
        <div className="bb-showcase-section-header">
          <SectionIndex number="03" label="PRODUCT INTERFACE" />
          <span className="bb-showcase-header-tag">WHAT THE APP LOOKS LIKE</span>
        </div>

        {/* Large Desktop Browser-Window Frame */}
        <div className="bb-browser-frame">
          <CornerTicks strokeColor="rgba(255, 255, 255, 0.18)" size={10} />

          {/* Top Chrome Bar */}
          <div className="bb-browser-chrome-bar">
            {/* Left: Window Control Dots */}
            <div className="bb-window-dots">
              <span className="bb-dot bb-dot--close" />
              <span className="bb-dot bb-dot--min" />
              <span className="bb-dot bb-dot--max" />
            </div>

            {/* Center: Title */}
            <div className="bb-browser-title-center">
              <span className="bb-browser-app-icon" />
              <span className="bb-browser-title-text">BLINKBRAIN · COMPANY BRAIN</span>
            </div>

            {/* Right: Operational Status Pill */}
            <div className="bb-browser-status-right">
              <span className="bb-status-indicator-live" />
              <span className="bb-status-text">DEL-NCR · SIMULATED CLUSTER</span>
            </div>
          </div>

          {/* Application Canvas Inside Frame (Three Regions) */}
          <div className="bb-browser-canvas">
            {/* =========================================================
                REGION 1: LEFT SIDEBAR
                ========================================================= */}
            <aside className="bb-sidebar-region">
              {/* Top Brand Dot/Network Mark */}
              <div className="bb-sidebar-brand-mark" title="BlinkBrain Substrate">
                <div className="bb-mark-triangle">
                  <span className="bb-mark-dot bb-mark-dot--1" />
                  <span className="bb-mark-dot bb-mark-dot--2" />
                  <span className="bb-mark-dot bb-mark-dot--3" />
                </div>
              </div>

              {/* Navigation Items */}
              <nav className="bb-sidebar-nav">
                <button
                  type="button"
                  className={`bb-sidebar-btn ${activeTab === 'overview' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                  title="Overview"
                >
                  <LayoutGrid size={18} />
                  <span className="bb-sidebar-label">Overview</span>
                </button>

                <button
                  type="button"
                  className={`bb-sidebar-btn ${activeTab === 'events' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('events')}
                  title="Events"
                >
                  <div className="bb-btn-badge-wrap">
                    <Flame size={18} />
                    <span className="bb-mini-badge">2</span>
                  </div>
                  <span className="bb-sidebar-label">Events</span>
                </button>

                <button
                  type="button"
                  className={`bb-sidebar-btn ${activeTab === 'agents' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('agents')}
                  title="Agents"
                >
                  <Cpu size={18} />
                  <span className="bb-sidebar-label">Agents</span>
                </button>

                <button
                  type="button"
                  className={`bb-sidebar-btn ${activeTab === 'graph' ? 'is-active' : ''}`}
                  onClick={() => {
                    setActiveTab('graph');
                    if (onLaunchDemo) onLaunchDemo('rootcause');
                  }}
                  title="Company Graph"
                >
                  <Network size={18} />
                  <span className="bb-sidebar-label">Graph</span>
                </button>
              </nav>

              {/* Sidebar Footer Indicator */}
              <div className="bb-sidebar-footer">
                <div className="bb-operator-avatar" title="Active Operator">OP</div>
              </div>
            </aside>

            {/* =========================================================
                REGION 2: MAIN WORKSPACE
                ========================================================= */}
            <main className="bb-main-workspace-region">
              {/* Workspace Header Lockup */}
              <div className="bb-workspace-header">
                <div>
                  <h1 className="bb-greeting-headline">Good evening, operator</h1>
                  <div className="bb-sim-cluster-label">
                    <span className="bb-sim-badge">DEMO DATA · DELHI NCR</span>
                    <span className="bb-sim-timestamp">0.8ms GRAPH LATENCY</span>
                  </div>
                </div>

                <div className="bb-live-status-pill">
                  <span className="bb-pill-pulse" />
                  <span>3 STORES OFF TARGET · 1 CAUSE FOUND</span>
                </div>
              </div>

              {/* Metric Cards Row with Tiny SVG Sparklines */}
              <div className="bb-metrics-row">
                {/* Metric 1 */}
                <div className="bb-metric-card">
                  <div className="bb-metric-top">
                    <span className="bb-metric-label">ORDERS ON TIME</span>
                    <span className="bb-metric-change positive">+1.2%</span>
                  </div>
                  <div className="bb-metric-val">98.4%</div>
                  <svg className="bb-sparkline" viewBox="0 0 100 24" aria-hidden="true">
                    <polyline
                      fill="none"
                      stroke="#2e7d32"
                      strokeWidth="1.6"
                      points="0,18 20,16 40,20 60,11 80,13 100,6"
                    />
                  </svg>
                  <span className="bb-metric-sim-note">*Simulated demo telemetry</span>
                </div>

                {/* Metric 2 */}
                <div className="bb-metric-card">
                  <div className="bb-metric-top">
                    <span className="bb-metric-label">CONNECTED TOPOLOGY</span>
                    <span className="bb-metric-change neutral">FALKORDB</span>
                  </div>
                  <div className="bb-metric-val">4,218</div>
                  <svg className="bb-sparkline" viewBox="0 0 100 24" aria-hidden="true">
                    <polyline
                      fill="none"
                      stroke="#171513"
                      strokeWidth="1.6"
                      points="0,20 25,18 45,15 70,10 85,9 100,8"
                    />
                  </svg>
                  <span className="bb-metric-sim-note">14,890 links in the graph</span>
                </div>

                {/* Metric 3 */}
                <div className="bb-metric-card">
                  <div className="bb-metric-top">
                    <span className="bb-metric-label">ROOT-CAUSE DURATION</span>
                    <span className="bb-metric-change positive">-68%</span>
                  </div>
                  <div className="bb-metric-val">4.2m</div>
                  <svg className="bb-sparkline" viewBox="0 0 100 24" aria-hidden="true">
                    <polyline
                      fill="none"
                      stroke="#F26B32"
                      strokeWidth="1.6"
                      points="0,8 20,12 40,9 60,16 80,18 100,20"
                    />
                  </svg>
                  <span className="bb-metric-sim-note">Time to find the cause</span>
                </div>
              </div>

              {/* "Needs your attention" Region */}
              <div className="bb-attention-section">
                <div className="bb-attention-header">
                  <span className="bb-attention-title">NEEDS YOUR ATTENTION</span>
                  <span className="bb-attention-count">2 ACTIVE ITEMS</span>
                </div>

                <div className="bb-attention-cards-grid">
                  {/* Card 1: Cold storage / inventory incident */}
                  <div className="bb-incident-card bb-incident-card--critical">
                    <CornerTicks size={7} strokeColor="rgba(220, 38, 38, 0.4)" />
                    <div className="bb-card-badge-row">
                      <span className="bb-incident-badge critical">
                        <span className="bb-dot-pulse-red" />
                        CRITICAL INCIDENT // UNRESOLVED
                      </span>
                      <span className="bb-incident-id">INC-849</span>
                    </div>

                    <h2 className="bb-incident-title">
                      South Delhi Cold Storage Sensor Delta
                    </h2>
                    <p className="bb-incident-desc">
                      Freezer #4 temperature spiked to +8°C. Cold-chain policy v2.4 automatically
                      quarantined 42 perishable dairy SKUs across Store-Delhi-04.
                    </p>

                    <div className="bb-incident-footer">
                      <div className="bb-incident-scope">
                        <span>AFFECTED:</span>
                        <code>STORE-DELHI-04</code>
                        <code>WMS-INVENTORY</code>
                        <code>PICKING-QUEUE</code>
                      </div>
                      <button
                        type="button"
                        className="bb-card-action-btn"
                        onClick={() => handleSelectPrompt("What's causing this incident?")}
                      >
                        <span>Trace Cause</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Pricing override / stale policy collision */}
                  <div className="bb-incident-card bb-incident-card--warning">
                    <CornerTicks size={7} strokeColor="rgba(242, 107, 50, 0.4)" />
                    <div className="bb-card-badge-row">
                      <span className="bb-incident-badge warning">
                        <span className="bb-dot-pulse-amber" />
                        POLICY COLLISION // ATTENTION NEEDED
                      </span>
                      <span className="bb-incident-id">DEC-104</span>
                    </div>

                    <h2 className="bb-incident-title">
                      Surge Multiplier Override (NCR Hub)
                    </h2>
                    <p className="bb-incident-desc">
                      Marketing campaign "Monsoon Rush" surge discount conflicts with logistics
                      dynamic delivery fee, suppressing courier availability by 18%.
                    </p>

                    <div className="bb-incident-footer">
                      <div className="bb-incident-scope">
                        <span>CONFLICT:</span>
                        <code>CAMPAIGN-ENGINE</code>
                        <code>DYNAMIC-PRICING</code>
                      </div>
                      <button
                        type="button"
                        className="bb-card-action-btn"
                        onClick={() => handleSelectPrompt("What should Operations know?")}
                      >
                        <span>View Conflict</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Short Event Activity List Beneath Attention Cards */}
              <div className="bb-activity-feed-section">
                <div className="bb-feed-header">
                  <span className="bb-feed-title">RECENT GRAPH ACTIVITY</span>
                  <span className="bb-feed-meta">LATEST FIRST</span>
                </div>

                <div className="bb-activity-items">
                  <div className="bb-activity-row">
                    <span className="bb-activity-time">12:48:12</span>
                    <span className="bb-activity-entity">STORE-DELHI-04</span>
                    <span className="bb-activity-action">Picking paused until freezer stock is confirmed</span>
                    <span className="bb-activity-status-pill ok">RESOLVED</span>
                  </div>

                  <div className="bb-activity-row">
                    <span className="bb-activity-time">12:44:05</span>
                    <span className="bb-activity-entity">CATALOG-SERVICE</span>
                    <span className="bb-activity-action">18 stock changes pulled in from the freezer sensor</span>
                    <span className="bb-activity-status-pill sync">SYNCED</span>
                  </div>

                  <div className="bb-activity-row">
                    <span className="bb-activity-time">12:39:50</span>
                    <span className="bb-activity-entity">RIDER-DISPATCH</span>
                    <span className="bb-activity-action">Delivery radius adjusted for 14 riders</span>
                    <span className="bb-activity-status-pill ok">OK</span>
                  </div>
                </div>
              </div>
            </main>

            {/* =========================================================
                REGION 3: RIGHT ASSISTANT PANEL
                ========================================================= */}
            <aside className="bb-assistant-panel-region">
              {/* Header Lockup */}
              <div className="bb-assistant-header">
                <div className="bb-assistant-spark-row">
                  <Sparkles size={15} className="bb-spark-icon" />
                  <span className="bb-assistant-eyebrow">ASK THE GRAPH</span>
                </div>
                <h2 className="bb-assistant-headline">Ask anything about your company</h2>
                <p className="bb-assistant-copy">
                  BlinkBrain correlates microservices, policy runbooks, inventory telemetry,
                  and team ownership to deliver verifiable answers with proof.
                </p>
              </div>

              {/* Three Compact Prompt Suggestions */}
              <div className="bb-suggestions-wrap">
                <span className="bb-suggestions-label">TRY ASKING</span>
                <div className="bb-suggestions-list">
                  {[
                    "What's causing this incident?",
                    "What should Operations know?",
                    "Which documents are out of date?"
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className={`bb-suggestion-chip ${queryText === suggestion ? 'is-selected' : ''}`}
                      onClick={() => handleSelectPrompt(suggestion)}
                    >
                      <span>{suggestion}</span>
                      <ChevronRight size={13} className="bb-chip-arr" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Working Demo Input */}
              <form className="bb-assistant-input-box" onSubmit={handleSubmit}>
                <div className="bb-input-field-wrap">
                  <Search size={14} className="bb-search-icon" />
                  <input
                    type="text"
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    placeholder="Ask BlinkBrain graph..."
                    className="bb-query-input"
                  />
                </div>
                <button type="submit" className="bb-query-submit-btn" aria-label="Submit query">
                  <ArrowRight size={13} />
                </button>
              </form>

              {/* Synthesized Simulated Answer Box */}
              <div className="bb-assistant-response-container">
                {isSynthesizing ? (
                  <div className="bb-synthesizing-state">
                    <span className="bb-dot-pulse" />
                    <span>Walking the graph…</span>
                  </div>
                ) : (
                  <div className="bb-response-card">
                    <div className="bb-response-top">
                      <span className="bb-answer-badge">
                        <CheckCircle2 size={12} />
                        VERIFIED GRAPH PROOF
                      </span>
                      <span className="bb-answer-confidence">100% GROUNDED</span>
                    </div>

                    <h4 className="bb-answer-summary">{activeAnswer.summary}</h4>
                    <p className="bb-answer-details">{activeAnswer.details}</p>

                    {/* Integrated Mini-Graph Preview */}
                    <MiniGraphEvidencePreview activePath={activeAnswer.path} />

                    {/* Ownership & Proof Metadata */}
                    <div className="bb-response-meta-row">
                      <div className="bb-meta-item">
                        <span className="bb-meta-k">OWNER:</span>
                        <span className="bb-meta-v">{activeAnswer.owner}</span>
                      </div>
                      <div className="bb-meta-item">
                        <span className="bb-meta-k">PROOF:</span>
                        <span className="bb-meta-v">{activeAnswer.evidence}</span>
                      </div>
                    </div>

                    {/* Actionable Next Step */}
                    <div className="bb-response-action-footer">
                      <span className="bb-action-note">{activeAnswer.status}</span>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </Container>
    </Section>
  );
}

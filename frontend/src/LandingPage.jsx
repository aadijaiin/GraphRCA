import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import {
  ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleAlert, Clock3, Code2, Database, ExternalLink, Eye, FileText, Flame,
  GitBranch, LockKeyhole, Maximize2, Menu, Minus, Network, Plus, RotateCcw,
  Search, ShieldAlert, ShieldCheck, Sparkles, Users, Workflow, X, Zap,
  Layers, Cpu, Server, Activity, ArrowDown, Play
} from 'lucide-react';
import { nodes as mockNodes, links as mockLinks, scenarios } from './data/mockCompany.js';
import RadialHeroNetwork from './components/RadialHeroNetwork.jsx';
import ComplexitySection, { TechnicalComplexitySvg } from './components/ComplexitySection.jsx';
import ArchitectureSection from './components/ArchitectureSection.jsx';
import TrackFitSection from './components/TrackFitSection.jsx';
import SpecializedAgentsSection from './components/SpecializedAgentsSection.jsx';
import FaqSection from './components/FaqSection.jsx';
import FinalCtaSection from './components/FinalCtaSection.jsx';
import Footer from './components/Footer.jsx';

// Reusable Foundational UI Components
import Navbar from './components/Navbar.jsx';
import Container from './components/ui/Container.jsx';
import Section from './components/ui/Section.jsx';
import Button from './components/ui/Button.jsx';
import SectionIndex from './components/ui/SectionIndex.jsx';
import SectionHeading from './components/ui/SectionHeading.jsx';
import Divider from './components/ui/Divider.jsx';
import CornerTicks from './components/ui/CornerTicks.jsx';

export { CornerTicks };

// -------------------------------------------------------------
// TECHNICAL COMPLEXITY CHART (The "Representational Gap" SVG)
// -------------------------------------------------------------
export function TechnicalComplexityChart() {
  return <TechnicalComplexitySvg />;
}

// -------------------------------------------------------------
// RADIAL NETWORK ILLUSTRATION (Hero Centerpiece with force-graph)
// -------------------------------------------------------------
function RadialHeroGraph({ onLaunchDemo }) {
  const fgRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 540, height: 480 });

  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = Math.max(380, Math.min(520, Math.round(w * 0.9)));
        setDimensions({ width: w, height: h });
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force?.('charge')?.strength?.(-130)?.distanceMax?.(360);
    fg.d3Force?.('link')?.distance?.(68)?.strength?.(0.42);
    fg.d3ReheatSimulation?.();
  }, []);

  const graphData = useMemo(() => {
    return {
      nodes: mockNodes.map(n => ({ ...n })),
      links: mockLinks.map(([source, target, label]) => ({ source, target, label })),
    };
  }, []);

  const paintNode = useCallback((node, ctx, globalScale) => {
    const isHub = node.id === 'sys-inv' || node.id === 'sys-surge' || node.id === 'LIN-101' || node.id === 'user-meera';
    const isTarget = node.id === 'sys-inv';

    let r = isHub ? 8.5 : 6.0;

    // Outer glow for hub nodes
    if (isHub) {
      const glowGrad = ctx.createRadialGradient(node.x, node.y, r * 0.7, node.x, node.y, r + 7);
      glowGrad.addColorStop(0, isTarget ? 'rgba(222, 78, 26, 0.45)' : 'rgba(255, 119, 51, 0.35)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 7, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();
    }

    // Node body
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.fillStyle = isTarget ? '#DE4E1A' : isHub ? '#1a1714' : '#4a4642';
    ctx.fill();

    // Specular / Ring
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = isTarget ? '#FF7733' : '#faf9f5';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Monospace Label on Hub Nodes
    if (isHub || globalScale > 1.3) {
      const fontSize = Math.max(9, Math.min(12, 10 / globalScale));
      ctx.font = `600 ${fontSize}px "DM Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const label = node.label || node.id;
      const textY = node.y + r + 4;
      const textW = ctx.measureText(label).width;

      ctx.fillStyle = 'rgba(215, 215, 208, 0.9)';
      ctx.fillRect(node.x - textW / 2 - 3, textY - 1, textW + 6, fontSize + 3);

      ctx.fillStyle = '#1a1714';
      ctx.fillText(label, node.x, textY);
    }
  }, []);

  return (
    <div className="radial-hero-container" ref={containerRef}>
      {/* Floating Leader Pills (Antimetal Signature Style) */}
      <div className="wv-pill-overlay" aria-hidden="true">
        <div className="wv-floating-pill pill-pos-1">
          <span className="wv-dot" />
          <span>STORE-DELHI-04 · DARK STORE</span>
        </div>
        <div className="wv-floating-pill pill-pos-2">
          <span className="wv-dot" />
          <span>NCR FREEZER SYNC · INVENTORY</span>
        </div>
        <div className="wv-floating-pill pill-pos-3">
          <span className="wv-dot" />
          <span>SURGE PRICING ENGINE · PRICING</span>
        </div>
      </div>

      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        backgroundColor="rgba(0, 0, 0, 0)"
        nodeCanvasObject={paintNode}
        nodeCanvasObjectMode={() => 'replace'}
        linkColor={() => 'rgba(26, 23, 20, 0.16)'}
        linkWidth={1.2}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={2.2}
        linkDirectionalParticleSpeed={0.007}
        linkDirectionalParticleColor={() => '#DE4E1A'}
        cooldownTicks={140}
        enableZoomInteraction={false}
        enablePanInteraction={false}
      />
    </div>
  );
}

// -------------------------------------------------------------
// MAIN ANTIMETAL-INSPIRED LANDING PAGE
// -------------------------------------------------------------
export default function LandingPage({ onLaunchDemo }) {
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  return (
    <div className="bb-page antimetal-page">
      {/* =========================================================
          1. REUSABLE RESPONSIVE NAVBAR (Black status strip + capsules)
          ========================================================= */}
      <Navbar onLaunchDemo={onLaunchDemo} />

      {/* =========================================================
          2. HERO: copy over a full-bleed network canvas
          ========================================================= */}
      <Section className="antimetal-hero bb-hero-section" id="hero" spacing="none">
        <RadialHeroNetwork />
        <Container className="hero-grid bb-hero-grid">
          {/* Left Column: Approx 48% Text Column */}
          <div className="hero-text-column bb-hero-text-column">
            <h1 className="hero-display-headline bb-hero-headline">
              Your company, finally connected.
            </h1>

            <p className="hero-editorial-subtitle bb-hero-subtitle">
              Axon links your tickets, docs, people and systems into one graph, so its agent can tell you what broke, why, and who should fix it.
            </p>

            <div className="hero-action-row bb-hero-actions">
              <Button
                variant="primary"
                size="lg"
                onClick={() => onLaunchDemo('rootcause')}
                ariaLabel="Launch the demo"
              >
                Launch the demo
              </Button>

              <Button
                variant="editorial"
                size="lg"
                href="#architecture"
                ariaLabel="Explore the architecture"
              >
                Explore the architecture
              </Button>
            </div>
          </div>
        </Container>
      </Section>

      <Divider variant="dashed" />

      {/* =========================================================
          3. CUSTOMER QUOTE / VIDEO SECTION
          ========================================================= */}
      <Section className="quote-video-section" id="quote" spacing="compact">
        <Container className="quote-grid">
          {/* Left: Video Preview Box */}
          <div className="video-card-container">
            <div className="video-preview-box">
              <div className="video-thumbnail-bg" />
              <button
                type="button"
                className="video-play-button"
                aria-label="Play video interview with Dev Malhotra"
                onClick={() => onLaunchDemo('rootcause')}
              >
                <Play size={15} fill="currentColor" />
              </button>
              <span className="video-duration-badge">2:07</span>
              <div className="video-network-mark">
                <Network size={16} strokeWidth={2} />
              </div>
            </div>
          </div>

          {/* Right: Two-Column Pullquote */}
          <div className="quote-text-container">
            <blockquote className="editorial-pullquote">
              “When a freezer fails at 2 a.m., I don’t need another dashboard. I need to know which campaign, which rider shift and which runbook it just broke.”
            </blockquote>
            <figcaption className="quote-credit">
              <div>
                <div className="credit-name">Dev Malhotra</div>
                <div className="credit-title">Operations Lead · demo persona</div>
              </div>
              <div className="credit-brand-badge">
                <Network size={12} />
                <span>DashMart Network</span>
              </div>
            </figcaption>
          </div>
        </Container>
      </Section>

      <Divider variant="dashed" />

      {/* =========================================================
          4. COMPLEXITY GAP & EDITORIAL PROBLEM SECTION (Prompt 3)
          ========================================================= */}
      <ComplexitySection />

      <Divider variant="dashed" />

      {/* =========================================================
          5. AXON ARCHITECTURE SECTION (Prompt 4)
          ========================================================= */}
      <ArchitectureSection />

      <Divider variant="dashed" />

      {/* Track 03 fit: each Company Brain focus area mapped to a live scenario */}
      <TrackFitSection onLaunchDemo={onLaunchDemo} />

      <Divider variant="dashed" />



      {/* =========================================================
          7. SPECIALIZED AGENTS & EXPLAINABLE WORKFLOW (Prompt 6)
          ========================================================= */}
      <SpecializedAgentsSection onLaunchDemo={onLaunchDemo} />

      <Divider variant="dashed" />

      {/* =========================================================
          8. FAQ SECTION (Prompt 7 Part A)
          ========================================================= */}
      <FaqSection />

      <Divider variant="dashed" />

      

      {/* =========================================================
          10. FINAL CTA SECTION (Prompt 7 Part C)
          ========================================================= */}
      <FinalCtaSection onLaunchDemo={onLaunchDemo} />

      {/* =========================================================
          11. MINIMAL EDITORIAL FOOTER (Prompt 7 Part D)
          ========================================================= */}
      <Footer onLaunchDemo={onLaunchDemo} />
    </div>
  );
}

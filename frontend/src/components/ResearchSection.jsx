import React from 'react';
import Container from './ui/Container.jsx';
import Section from './ui/Section.jsx';
import SectionIndex from './ui/SectionIndex.jsx';
import CornerTicks from './ui/CornerTicks.jsx';
import Button from './ui/Button.jsx';
import { ArrowUpRight, ArrowRight } from 'lucide-react';

/**
 * Technical SVG Illustration 1: Directed Graph Traversal
 */
function DagTraversalSvg() {
  return (
    <div className="bb-card-svg-wrap">
      <svg
        viewBox="0 0 380 170"
        className="bb-card-tech-svg"
        role="img"
        aria-label="Technical directed graph traversal diagram"
      >
        <defs>
          <pattern id="dotGrid1" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.8" fill="rgba(23, 21, 19, 0.12)" />
          </pattern>
          <marker id="arr1" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
            <polygon points="0,1 6,3 0,5" fill="#F26B32" />
          </marker>
        </defs>

        <rect width="380" height="170" fill="rgba(245, 244, 237, 0.6)" />
        <rect width="380" height="170" fill="url(#dotGrid1)" />

        {/* Construction Grid Axis */}
        <line x1="30" y1="140" x2="350" y2="140" stroke="rgba(23, 21, 19, 0.15)" strokeWidth="1" strokeDasharray="2 2" />
        <line x1="30" y1="30" x2="30" y2="140" stroke="rgba(23, 21, 19, 0.15)" strokeWidth="1" strokeDasharray="2 2" />

        {/* Directed Traversal Edges */}
        <path d="M 60 110 L 140 55" stroke="#F26B32" strokeWidth="1.8" strokeDasharray="4 3" markerEnd="url(#arr1)" />
        <path d="M 140 55 L 230 95" stroke="#F26B32" strokeWidth="1.8" strokeDasharray="4 3" markerEnd="url(#arr1)" />
        <path d="M 230 95 L 310 45" stroke="#F26B32" strokeWidth="1.8" strokeDasharray="4 3" markerEnd="url(#arr1)" />
        <path d="M 140 55 L 200 130" stroke="rgba(23, 21, 19, 0.25)" strokeWidth="1.2" strokeDasharray="2 2" />

        {/* Graph Nodes */}
        {/* Node 1: Alert */}
        <g transform="translate(60, 110)">
          <circle cx="0" cy="0" r="14" fill="#FFFFFF" stroke="#F26B32" strokeWidth="2" />
          <circle cx="0" cy="0" r="5" fill="#F26B32" />
          <text x="0" y="24" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5px" fontWeight="600" fill="#171513">
            SENSOR-FRZ-04
          </text>
        </g>

        {/* Node 2: Service */}
        <g transform="translate(140, 55)">
          <circle cx="0" cy="0" r="14" fill="#FFFFFF" stroke="#171513" strokeWidth="1.8" />
          <circle cx="0" cy="0" r="5" fill="#171513" />
          <text x="0" y="-18" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5px" fontWeight="600" fill="#171513">
            NCR-SYNC
          </text>
        </g>

        {/* Node 3: Policy */}
        <g transform="translate(230, 95)">
          <circle cx="0" cy="0" r="14" fill="#FFFFFF" stroke="#A99B16" strokeWidth="1.8" />
          <circle cx="0" cy="0" r="5" fill="#A99B16" />
          <text x="0" y="24" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5px" fontWeight="600" fill="#171513">
            COLD-POLICY
          </text>
        </g>

        {/* Node 4: Dark Store */}
        <g transform="translate(310, 45)">
          <circle cx="0" cy="0" r="14" fill="#FFFFFF" stroke="#F26B32" strokeWidth="2" />
          <circle cx="0" cy="0" r="5" fill="#F26B32" />
          <text x="0" y="-18" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5px" fontWeight="600" fill="#171513">
            STORE-DEL-04
          </text>
        </g>

        {/* Passive Node */}
        <g transform="translate(200, 130)">
          <circle cx="0" cy="0" r="10" fill="#F5F4ED" stroke="rgba(23, 21, 19, 0.3)" strokeWidth="1.2" />
          <circle cx="0" cy="0" r="3" fill="#6E6D68" />
        </g>

        {/* Cypher Monospace Annotation */}
        <rect x="22" y="148" width="220" height="16" fill="rgba(23, 21, 19, 0.08)" rx="2" />
        <text x="28" y="159" fontFamily="var(--font-mono)" fontSize="7.5px" fontWeight="600" fill="#171513" letterSpacing="0.04em">
          {"CYPHER: MATCH (a)-[:DEPENDS_ON*1..3]->(b)"}
        </text>
      </svg>
    </div>
  );
}

/**
 * Technical SVG Illustration 2: Cryptographic Provenance Envelope
 */
function ProvenanceEnvelopeSvg() {
  return (
    <div className="bb-card-svg-wrap">
      <svg
        viewBox="0 0 380 170"
        className="bb-card-tech-svg"
        role="img"
        aria-label="Cryptographic provenance verification schematic"
      >
        <defs>
          <pattern id="dotGrid2" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.8" fill="rgba(23, 21, 19, 0.12)" />
          </pattern>
        </defs>

        <rect width="380" height="170" fill="rgba(245, 244, 237, 0.6)" />
        <rect width="380" height="170" fill="url(#dotGrid2)" />

        {/* Outer Sealed Envelope Border */}
        <rect x="28" y="24" width="324" height="122" rx="4" fill="none" stroke="rgba(23, 21, 19, 0.25)" strokeWidth="1" strokeDasharray="3 3" />

        {/* Internal Evidence Nodes */}
        <rect x="44" y="40" width="130" height="38" rx="3" fill="#FFFFFF" stroke="#171513" strokeWidth="1.2" />
        <text x="54" y="55" fontFamily="var(--font-mono)" fontSize="8px" fontWeight="700" fill="#F26B32">
          TELEMETRY HASH
        </text>
        <text x="54" y="68" fontFamily="var(--font-mono)" fontSize="7.5px" fill="#6E6D68">
          SHA-256: 0x9f4a...e312
        </text>

        <rect x="44" y="88" width="130" height="38" rx="3" fill="#FFFFFF" stroke="#171513" strokeWidth="1.2" />
        <text x="54" y="103" fontFamily="var(--font-mono)" fontSize="8px" fontWeight="700" fill="#A99B16">
          RBAC VALIDATION
        </text>
        <text x="54" y="116" fontFamily="var(--font-mono)" fontSize="7.5px" fill="#6E6D68">
          SCOPE: ops.read · AUTHORIZED
        </text>

        {/* Synthesis Hub */}
        <path d="M 174 59 L 214 83" stroke="#F26B32" strokeWidth="1.6" strokeDasharray="3 2" />
        <path d="M 174 107 L 214 83" stroke="#F26B32" strokeWidth="1.6" strokeDasharray="3 2" />

        {/* Provenance Seal Box */}
        <rect x="214" y="50" width="124" height="66" rx="3" fill="#171513" />
        <text x="226" y="70" fontFamily="var(--font-mono)" fontSize="8.5px" fontWeight="700" fill="#F5F4ED">
          PROOF ENVELOPE
        </text>
        <text x="226" y="85" fontFamily="var(--font-mono)" fontSize="7px" fill="#A99B16">
          DETERMINISTIC CYPHER
        </text>
        <text x="226" y="102" fontFamily="var(--font-mono)" fontSize="7.5px" fill="#F26B32">
          ✓ ZERO HALLUCINATION
        </text>

        {/* Bottom Banner */}
        <rect x="28" y="150" width="180" height="14" fill="rgba(23, 21, 19, 0.08)" rx="2" />
        <text x="34" y="160" fontFamily="var(--font-mono)" fontSize="7.5px" fontWeight="600" fill="#171513" letterSpacing="0.04em">
          MATHEMATICAL AUDIT TRAIL // FALKORDB
        </text>
      </svg>
    </div>
  );
}

/**
 * Technical SVG Illustration 3: Temporal Graph Drift Detection
 */
function TemporalDriftSvg() {
  return (
    <div className="bb-card-svg-wrap">
      <svg
        viewBox="0 0 380 170"
        className="bb-card-tech-svg"
        role="img"
        aria-label="Temporal graph drift and stale documentation diagram"
      >
        <defs>
          <pattern id="dotGrid3" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.8" fill="rgba(23, 21, 19, 0.12)" />
          </pattern>
          <marker id="arr3" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
            <polygon points="0,1 6,3 0,5" fill="#171513" />
          </marker>
        </defs>

        <rect width="380" height="170" fill="rgba(245, 244, 237, 0.6)" />
        <rect width="380" height="170" fill="url(#dotGrid3)" />

        {/* Timeline Axis */}
        <line x1="30" y1="120" x2="350" y2="120" stroke="rgba(23, 21, 19, 0.2)" strokeWidth="1.2" />
        <circle cx="80" cy="120" r="3" fill="#171513" />
        <text x="80" y="136" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8px" fill="#6E6D68">T-0 (HISTORICAL)</text>

        <circle cx="280" cy="120" r="3" fill="#F26B32" />
        <text x="280" y="136" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8px" fontWeight="700" fill="#F26B32">T-1 (CURRENT)</text>

        {/* Rule Nodes */}
        <g transform="translate(80, 60)">
          <rect x="-42" y="-18" width="84" height="36" rx="3" fill="#FFFFFF" stroke="#6E6D68" strokeWidth="1.2" />
          <text x="0" y="-3" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8px" fontWeight="600" fill="#6E6D68">
            MEM-01
          </text>
          <text x="0" y="10" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7.5px" fill="#6E6D68">
            CAP: ₹30 [STALE]
          </text>
        </g>

        <g transform="translate(280, 60)">
          <rect x="-42" y="-18" width="84" height="36" rx="3" fill="#FFFFFF" stroke="#F26B32" strokeWidth="1.6" />
          <text x="0" y="-3" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8px" fontWeight="700" fill="#F26B32">
            MEM-02
          </text>
          <text x="0" y="10" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7.5px" fill="#171513">
            CAP: ₹50 [ACTIVE]
          </text>
        </g>

        {/* Supersedes Transition */}
        <path d="M 238 60 L 122 60" stroke="#171513" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arr3)" />
        <text x="180" y="52" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7px" fontWeight="700" fill="#171513">
          SUPERSEDES
        </text>

        {/* Warning Badge for Contradictory Doc */}
        <g transform="translate(180, 95)">
          <rect x="-56" y="-10" width="112" height="20" rx="3" fill="rgba(220, 38, 38, 0.12)" stroke="rgba(220, 38, 38, 0.4)" strokeWidth="1" />
          <text x="0" y="3" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7.5px" fontWeight="600" fill="#dc2626">
            ⚠ NOTION RUNBOOK DRIFT
          </text>
        </g>
      </svg>
    </div>
  );
}

/**
 * 3 Original Axon Research Articles
 */
const RESEARCH_ARTICLES = [
  {
    id: 'res-1',
    category: 'GRAPH MODEL',
    date: 'OCT 14, 2026',
    readTime: '6 MIN READ',
    title: 'Why we used a graph, not just embeddings',
    summary: 'Similar-sounding text doesn’t tell you what caused what. Following real links between systems does, and FalkorDB makes that one query.',
    author: 'Axon team',
    illustration: <DagTraversalSvg />,
  },
  {
    id: 'res-2',
    category: 'EXPLAINABILITY',
    date: 'OCT 08, 2026',
    readTime: '8 MIN READ',
    title: 'Showing the path behind every answer',
    summary: 'How each answer carries the hops and Cypher query that produced it, so anyone can check the agent’s work.',
    author: 'Axon team',
    illustration: <ProvenanceEnvelopeSvg />,
  },
  {
    id: 'res-3',
    category: 'KNOWLEDGE DRIFT',
    date: 'SEP 29, 2026',
    readTime: '5 MIN READ',
    title: 'Catching docs that quietly went stale',
    summary: 'A SUPERSEDES edge between old and new decisions lets the graph spot every runbook still quoting the old rule.',
    author: 'Axon team',
    illustration: <TemporalDriftSvg />,
  },
];

/**
 * ResearchSection
 * Implementation of Prompt 7 Part B:
 * - Editorial serif heading near upper left
 * - Minimal "View all" action aligned to right
 * - 3 columns of research cards on desktop
 * - Wide technical illustration at the top of each card
 * - Category & date metadata, serif title, concise summary, author & read time
 * - Responsive 3 -> 2 -> 1 column stacking
 */
export default function ResearchSection() {
  return (
    <Section className="bb-research-section" id="research" spacing="default">
      <Container className="bb-research-container">
        {/* Section Index Header */}
        <div className="bb-research-header-row">
          <SectionIndex number="06" label="BUILD NOTES" />
          <span className="bb-research-header-tag">HOW WE BUILT IT</span>
        </div>

        {/* Section Headline Lockup */}
        <div className="bb-research-title-row">
          <h2 className="bb-research-headline">Notes from the build.</h2>

          <a
            href="#research"
            className="bb-research-view-all-link"
            aria-label="View all research papers in archive"
          >
            <span>All notes</span>
            <ArrowRight size={13} />
          </a>
        </div>

        {/* Three-Column Editorial Research Cards Grid */}
        <div className="bb-research-grid">
          {RESEARCH_ARTICLES.map((article) => (
            <article key={article.id} className="bb-research-card">
              <CornerTicks strokeColor="rgba(23, 21, 19, 0.28)" size={8} />

              {/* Wide Technical SVG Illustration */}
              {article.illustration}

              <div className="bb-card-body">
                {/* Meta Row: Category, Date, Read Time */}
                <div className="bb-card-meta-line">
                  <span className="bb-card-cat">{article.category}</span>
                  <span className="bb-card-sep">·</span>
                  <span className="bb-card-date">{article.date}</span>
                  <span className="bb-card-sep">·</span>
                  <span className="bb-card-read">{article.readTime}</span>
                </div>

                {/* Serif Article Headline */}
                <h3 className="bb-card-title">{article.title}</h3>

                {/* Concise Summary */}
                <p className="bb-card-summary">{article.summary}</p>

                {/* Author / Source Footer */}
                <div className="bb-card-footer">
                  <span className="bb-card-author">{article.author}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}

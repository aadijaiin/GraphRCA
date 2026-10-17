# CLAUDE.md — BlinkBrain / BlinkCart Company Brain Context & Guide

This file provides comprehensive context for Claude and AI assistants working on this codebase. It documents the product concept, technical architecture, component structure, design system, data contracts, and implementation details.

---

## 1. Project Overview

**BlinkBrain** (historically referenced as *BlinkCart Company Brain*) is a graph-powered, AI-native "Company Brain" built for high-velocity quick-commerce operations (10-minute delivery networks like Blinkit, Zepto, or Instacart).

In quick-commerce, operational velocity creates a severe **Representational Gap**:
- Critical knowledge is fragmented across microservices, Jira tickets, Postgres replicas, promotional marketing calendars, outdated Notion runbooks, and on-call tribal memory.
- When an incident occurs (e.g., a dark-store cold storage failure), standard monitoring dashboards only show symptoms (spikes in order cancellations, rider idle time) without showing cross-department causality.
- Autonomous AI agents operating without ground truth hallucinate or perform unauthorized actions.

**BlinkBrain solves this** by connecting company entities (microservices, physical dark stores, policy runbooks, team members, tickets, and automated decisions) into a **verifiable, living property graph** powered by **FalkorDB / Cypher**. Every agent action is grounded in mathematical graph traversal, verifiable proof envelopes, and strict RBAC boundaries.

The repository contains two interconnected experiences:
1. **The Marketing Landing Page (`/`)**: A recreation of the **Antimetal** editorial technology aesthetic with **Beautiful UI** interactive agent workflow visualizations.
2. **The Investigation Workbench (`/app`)**: the real product. It loads the FalkorDB graph and alerts from the FastAPI backend (`/api/*`), runs an investigation live over SSE or replays a recorded run, and renders only the events in `docs/events.md`: tool-call timeline, touched nodes and edges, the cited answer, and the memories written.

---

## 2. Tech Stack & Environment

- **Framework**: React 19 (`react`, `react-dom`)
- **Build Tool**: Vite 8 (`vite`, `@vitejs/plugin-react`); each route is a lazy-loaded chunk
- **Graph Visualization**: `react-force-graph-2d` (HTML5 Canvas-based force simulation powered by d3-force)
- **Icons**: `lucide-react`
- **Fonts**: `Geist` (UI/body), `Geist Mono` (labels/telemetry), `Newsreader` (serif display + editorial lead) via Google Fonts.
- **Styling**: Single unified vanilla CSS architecture (`src/styles.css`) using CSS Custom Properties (design tokens), standard CSS Grid/Flexbox, and responsive media queries. No Tailwind, no CSS-in-JS libraries.
- **Backend**: the FastAPI app in `../backend`. The dev server proxies `/api` to `http://localhost:8000`; in production FastAPI serves `dist/` from the same origin. There is no mock fallback in `/app`: if the API is down the workbench says so, and only the recorded replay (`public/runs/ALT-001.json`) still plays.

### Common Commands

```bash
# Start local development server on :5173 (proxies /api to :8000)
npm run dev

# Run production build (Vite bundle & asset compression)
npm run build

# Preview production build locally
npm run preview
```

---

## 3. Directory & File Structure

```
blinkcart-company-brain/
├── CLAUDE.md                   # This context file for AI assistants
├── README.md                   # Project overview and quickstart
├── index.html                  # HTML template with Google Fonts (fonts are imported in styles.css: Geist, Geist Mono, Newsreader)
├── package.json                # Project dependencies and npm scripts
├── public/
│   ├── favicon.svg
│   └── runs/ALT-001.json       # recorded event log for replay (investigate_cli.py --events)
├── dist/                       # Production build output
└── src/
    ├── main.jsx                # Application root entry point
    ├── App.jsx                 # Route manager: / landing, /app workbench, ?alert= deep links
    ├── LandingPage.jsx         # Antimetal-style marketing landing page composition
    ├── styles.css              # Universal design tokens and styling (both landing page & lab)
    ├── colors.js               # Node colours and sizes per graph label
    ├── events.js               # Live SSE stream and recorded replay; same events either way
    ├── workspace/
    │   ├── Workspace.jsx       # /app: alerts, KPIs, timeline, answer, evidence drawer
    │   ├── InvestigationGraph.jsx # FalkorDB graph canvas; touched nodes/edges light up
    │   └── useInvestigation.js # Event queue and state; the UI renders events and nothing else
    ├── data/
    │   └── mockCompany.js      # Illustrative graph used only by landing-page visuals
    └── components/
        ├── Navbar.jsx                  # 3-capsule sticky frosted header & mobile drawer
        ├── RadialHeroNetwork.jsx       # Living canvas-based radial graph with leader pills
        ├── ComplexitySection.jsx       # "Representational Gap" vector chart & editorial lead
        ├── ArchitectureSection.jsx     # Charcoal panel + 4-tier isometric wireframe SVG
        ├── ProductPreviewShowcase.jsx  # 3-region desktop application canvas preview
        ├── SpecializedAgentsSection.jsx# 5 capability cards + 7-stage Beautiful UI graph trace
        ├── FaqSection.jsx              # 6 accessible accordion items on graph & agent reasoning
        ├── ResearchSection.jsx         # 3 technical research cards with custom engineering SVGs
        ├── FinalCtaSection.jsx         # Conversion block with corner ticks & cluster telemetry
        ├── Footer.jsx                  # Dark editorial footer with live graph badge & link matrix
        ├── AgentWorkflowShowcase.jsx   # Dedicated standalone workflow component
        └── ui/                         # Reusable editorial technology UI primitives
            ├── Button.jsx              # Buttons with primary, editorial, and outline variants
            ├── Container.jsx           # Responsive width containers (1220px, 860px)
            ├── CornerTicks.jsx         # Signature Antimetal-style wireframe corner marks
            ├── Divider.jsx             # Dotted, dashed, and solid horizontal dividers
            ├── Section.jsx             # Section wrapper with standardized vertical rhythm
            ├── SectionHeading.jsx      # Reusable section headers
            └── SectionIndex.jsx        # Editorial monospace section index tags (e.g. `[ 01 ]`)
```

---

## 4. Design System & Visual Specification

The visual system is derived from the **Antimetal editorial technology aesthetic** paired with **Beautiful UI interaction patterns**:

### Palette & Tokens (`src/styles.css`)

All colors are centralized in `:root` custom properties:

```css
/* Editorial Marketing Palette (Warm Antimetal Canvas) */
--bb-bg: #D7D7D0;                   /* Main warm page canvas */
--bb-text-primary: #1A1614;         /* Near-black primary text */
--bb-text-secondary: #6E6D68;       /* Muted grey-olive supporting text */
--bb-surface-light: #F4F4E7;        /* Warm cream cards, pills, and inputs */
--bb-surface-dark: #171513;         /* Dark charcoal surfaces and primary buttons */
--bb-accent-orange: #F26B32;        /* Vibrant orange accent (causal paths, highlights) */
--bb-accent-olive: #A99B16;         /* Restrained olive-mustard secondary accent */
--bb-border-subtle: rgba(23, 21, 19, 0.16);
--bb-border-dashed: rgba(23, 21, 19, 0.22);
--bb-border-dotted: rgba(23, 21, 19, 0.32);

/* Workspace accents (light product UI, /app) */
--am-orange: #e8622b;               /* Active trace path, tickets, "needs you" */
--am-olive: #7d8a24;                /* Active decisions, healthy deltas */
--am-red: #c8382d;                  /* Stale documents, access walls */
--am-violet: #7f6cc4;               /* Documents */
--am-green: #3e8e5a;                /* Live / grounded states */
/* Surface tokens (--am-surface, --am-card, --am-ink, --am-line…) are scoped on .app-shell */
```

### Typography Rules

1. **Editorial Serif (`--font-serif: "Newsreader", Georgia, serif`)**:
   - Used for all major display headlines (`.bb-hero-headline`, `.bb-arch-panel-headline`, `.bb-agents-headline`, `.bb-cta-headline`).
   - Often paired with italic highlights (`<span className="bb-headline-italic">`).
2. **Sans-Serif (`--font-sans: "Geist", sans-serif`)**:
   - Used for body copy, paragraphs, navigation links, and standard controls.
   - Generous line height ($1.58 - 1.68$) for editorial readability.
3. **Monospace (`--font-mono: "Geist Mono", monospace`)**:
   - Used for section indices (`02 — ARCHITECTURE`), timestamps, Cypher code snippets, SHA hashes, telemetry metrics, and badges.

### Responsive Breakpoints & Mobile Overflow Rules

- **1440px**: Desktop standard. Full 2-column editorial grids.
- **1150px**: Compact desktop. Preserves side-by-side hero and architecture layout.
- **1024px**: Tablet landscape. Fluid scaling, 32px page margins.
- **768px**: Tablet portrait. Hero, architecture, and agent sections stack vertically.
- **390px**: Mobile. **Strict constraint**: `document.documentElement.scrollWidth` must never exceed `390px`.
  - All grid/flex containers must include `min-width: 0; max-width: 100%;`.
  - Scrollable rails (like `.bb-stages-rail`) must have `overflow-x: auto;` and `width: 100%;` while their parents have `overflow: hidden;`.

---

## 5. Page-by-Page & Section Breakdown

### Route 1: The Landing Page (`/` / `LandingPage.jsx`)

The landing page consists of 11 distinct sections assembled in sequential order:

1. **Floating Navbar (`Navbar.jsx`)**:
   - Sticky, frosted three-part pill navbar (no status strip): Left links capsule (`Architecture`, `Agent Workflow`, `Research`, `FAQ`), Center brand capsule (`BlinkBrainSymbol` + wordmark), Right actions capsule (`Sign In` + `Launch demo`).
   - Mobile: Transforms to brand capsule + "Launch demo" button + circular hamburger toggle opening an accessible drawer.
2. **Editorial Hero (`RadialHeroNetwork.jsx` / `LandingPage.jsx`)**:
   - Left column (48%): Single-line serif headline *"Your company, finally connected."*, serif lead paragraph, primary CTA *"Launch the demo"*, secondary CTA *"Explore the architecture"*.
   - Full-bleed background (`RadialHeroNetwork.jsx`): a 3D point-cloud graph (Canvas 2D with a perspective camera) that rotates slowly and auto-cycles between a monochrome constellation with hairline links and a colored radial burst (ink/olive/mustard/orange from the `--hero-*` tokens) with spokes from the hub. Drag to spin it (grab cursor, inertia on release); a click without dragging advances the phase; the hovered dot grows. The hero grid passes pointer events through and only the copy column captures them. The loop pauses off-screen and when the tab is hidden; under reduced motion it neither auto-spins nor auto-cycles.
3. **Customer Quote & Video Preview (`LandingPage.jsx`)**:
   - Operational quote by Dev Malhotra (VP of Operations & Logistics) on dark store cold-chain dependencies.
   - 16:9 video preview card with play button, duration tag, and verified network pill.
4. **Complexity Gap (`ComplexitySection.jsx`)**:
   - Monospace section index `[ 01 ]` and label `FIG. 1.0 · OPERATIONAL DIVERGENCE`.
   - Left: Custom responsive SVG chart illustrating the **Representational Gap** (operational complexity curve vs. human cognitive capacity).
   - Right: Editorial essay with drop-cap "A" explaining the quick-commerce distributed mesh.
5. **System Architecture (`ArchitectureSection.jsx`)**:
   - Section index `02` and label `SYSTEM ARCHITECTURE // FOUR-TIER OPERATIONAL STACK`.
   - Left: Dark rectangular charcoal panel with cream text detailing graph grounding and agent governance.
   - Right: 4-tier isometric wireframe SVG diagram (`Governance & Objectives` $\to$ `Autonomous Reasoning` $\to$ `Company World Model` $\to$ `Operational Systems`).
6. **Product Interface Showcase (`ProductPreviewShowcase.jsx`)**:
   - Section index `03` and label `PRODUCT INTERFACE // SIMULATED PRODUCTION WORKSPACE`.
   - Desktop browser frame on dark textured background with window control dots.
   - Three-region internal canvas: Left icon sidebar, Center workspace (metrics, active incident cards, graph activity feed), Right AI reasoning assistant with prompt chips and verified causal path SVG.
7. **Specialized Agents & Workflow (`SpecializedAgentsSection.jsx`)**:
   - Section index `04` and label `SPECIALIZED REASONING // AUTONOMOUS MULTI-AGENT SUBSTRATE`.
   - Left: 5 selectable capability cards with dashed borders and corner ticks:
     1. *Root Cause* (Causality)
     2. *Impact Analysis* (Blast radius)
     3. *Smart Delegation* (Mitigation)
     4. *Knowledge Maintenance* (Topology drift)
     5. *Access Control* (Provable security)
   - Right: Dark workflow window featuring playback controls, a 7-stage sequential rail (Beautiful UI pattern), a synchronized `ForceGraph2D` living topology canvas, and source-linked evidence cards.
8. **Frequently Asked Questions (`FaqSection.jsx`)**:
   - Section index `05` and label `FAQ // FREQUENTLY ASKED QUESTIONS`.
   - 6 accessible accordion questions with `+`/`−` controls detailing property graph ingestion, root-cause traversal, agent decision proofs, RBAC enforcement, Notion runbook drift, and real-world system connectors.
9. **Research Log (`ResearchSection.jsx`)**:
   - Section index `06` and label `RESEARCH LOG // THEORETICAL & OPERATIONAL PAPERS`.
   - 3 research cards featuring custom engineering SVGs:
     1. *Tracing Operational Dependencies Through Graphs* (DAG Cypher traversal)
     2. *Why Provenance Matters for AI Agents* (Cryptographic proof envelope)
     3. *Keeping Company Knowledge Current* (Temporal graph drift & supersedes vector)
10. **Final CTA (`FinalCtaSection.jsx`)**:
    - Full-bleed dark grain panel, centered serif headline *"The explainable brain for quick commerce."*, cream primary pill + text link.
11. **Editorial Footer (`Footer.jsx`)**:
    - Light canvas with four dashed, corner-ticked columns (*Product*, *Resources*, *Lab*, status) using mono headings and serif links, plus a live badge (`ALL GRAPHS HEALTHY`).

---

### Route 2: Investigation Workbench (`/app` / `workspace/Workspace.jsx`)

Rendered for `/app` (or hash `#app`), and for any URL with `?alert=` (e.g. `/?alert=ALT-001&mode=replay`). Light cream product-UI theme:

1. **Icon rail**: brand glyph (returns to `/`) and jump links to alerts, graph, investigation and memory.
2. **Top bar**: `← Overview`, tenant breadcrumb, LIVE/REPLAY pill, the model that chose the tool calls, API status, and a model-backend picker (server default, scripted, claude, local) passed as `?backend=` to `/api/investigate`.
3. **Main column**: real counts from the graph (nodes, alerts, touched nodes, findings); alert cards from `/api/alerts` with **Investigate** (live SSE) and **Replay** (alerts with a file in `public/runs/`); the company graph from `/api/graph`; memories written by the run.
4. **Assistant column**: the answer (summary, root cause and amplifier chips, claims with source and finding buttons, recommended actions, validator drops) above the step-by-step timeline (memory recall, dispatched tasks with status, tool calls with node/edge counts, who is thinking). Hovering a tool step highlights the nodes and edges it touched.
5. **Evidence drawer**: source messages from `/api/artifacts`, or the findings behind a claim, action or node.

Landing-page "launch demo" buttons open `/app?scenario=…`; `rootcause` starts the ALT-001 replay, the others just open the workbench.

---

## 6. Data and Backend Contracts

The workbench uses only the backend contracts in `../docs`:

| Action | HTTP Request |
| :--- | :--- |
| Load graph | `GET /api/graph?tenant=dashmart` → `{nodes: [{id, label, name}], links: [{source, type, target}]}` |
| Alerts | `GET /api/alerts?tenant=dashmart` |
| Source messages | `GET /api/artifacts?tenant=dashmart&ids=ART-A01,…` |
| Investigate | `GET /api/investigate/{alert_id}?tenant=dashmart[&backend=scripted]` (SSE, events in `docs/events.md`) |

`src/data/mockCompany.js` is illustrative data for the landing-page animations only; the workbench never reads it.

---

## 7. Guidelines for Future AI / Claude Contributions

When contributing to this repository, observe the following rules:

1. **Preserve Operational Dashboard & Backend Contracts**:
   - Never remove or break `/app` (`workspace/`) or its event-driven contract: the UI renders events from `docs/events.md` and nothing else, live and replay alike.
   - Never add invented data to the workbench; every number and claim on it comes from the API or a recorded run.
2. **Preserve the Antimetal Editorial Aesthetic**:
   - Always use the centralized CSS custom properties in `src/styles.css` (`--bb-*`). Never hardcode hex codes directly into inline styles or components.
   - Maintain the typography hierarchy: `Newsreader` for display headlines, `Geist` for body copy and UI, and `Geist Mono` for technical labels.
   - When adding new sections, use the primitives in `src/components/ui/` (`Section`, `Container`, `SectionIndex`, `CornerTicks`, `Divider`, `Button`).
3. **Strict Mobile Responsiveness**:
   - Always verify that new elements do not introduce horizontal scroll on mobile (`390px` viewport).
   - Use `min-width: 0; max-width: 100%;` on flex and grid children.
4. **Accessible Semantics**:
   - Maintain proper ARIA attributes (`aria-expanded`, `aria-controls`, `aria-selected`, `role="tab"`, `role="dialog"`).
   - Ensure all interactive icon-only buttons include descriptive `aria-label` tags.
5. **Performance & Energy Efficiency**:
   - Always clean up `setInterval` or `requestAnimationFrame` loops in `useEffect` cleanup functions.
   - Respect user motion preferences via `@media (prefers-reduced-motion: reduce)`.
   - Never create high-frequency unconstrained force graph reheat loops.

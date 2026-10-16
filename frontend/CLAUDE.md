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
2. **The Operational Explainability Lab (`/app`)**: An interactive, single-screen operational workbench with live force-directed graph exploration, 4 incident simulation scenarios, role-based access control, an X-Ray hop inspector, and natural-language QA grounded in Cypher queries.

---

## 2. Tech Stack & Environment

- **Framework**: React 18 (`react`, `react-dom`)
- **Build Tool**: Vite 6 (`vite`)
- **Graph Visualization**: `react-force-graph-2d` (HTML5 Canvas-based force simulation powered by d3-force)
- **Icons**: `lucide-react`
- **Fonts**: `Geist` (UI/body), `Geist Mono` (labels/telemetry), `Newsreader` (serif display + editorial lead) via Google Fonts.
- **Styling**: Single unified vanilla CSS architecture (`src/styles.css`) using CSS Custom Properties (design tokens), standard CSS Grid/Flexbox, and responsive media queries. No Tailwind, no CSS-in-JS libraries.
- **Backend (Optional / Live Mode)**: FastAPI service communicating over HTTP (`http://localhost:8000`) with FalkorDB / Redis Graph. If unavailable, the frontend operates seamlessly via a built-in deterministic fallback adapter.

### Common Commands

```bash
# Start local development server (bound to 0.0.0.0:5173)
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
├── .env.example                # Example environment variables (VITE_API_BASE_URL)
├── .env.local                  # Local environment overrides
├── dist/                       # Production build output
└── src/
    ├── main.jsx                # Application root entry point
    ├── App.jsx                 # Route manager & Operational Explainability Lab workspace
    ├── LandingPage.jsx         # Antimetal-style marketing landing page composition
    ├── styles.css              # Universal design tokens and styling (both landing page & lab)
    ├── data/
    │   └── mockCompany.js      # Graph topology, scenarios, entity mocks, and role definitions
    ├── services/
    │   └── companyBrainApi.js  # API client with automatic deterministic fallback
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

### Route 2: Operational Explainability Lab (`/app` / `App.jsx`)

The operational dashboard is rendered when the route is `/app` (or hash `#app`). It uses a light, cream product-UI theme (Geist, serif headings, mono labels, white cards on `#f7f6f0`):

1. **Icon rail (`AppRail`)**: brand glyph (returns to `/`) and section icons.
2. **Top bar (`Header`)**: `← Overview`, mono breadcrumb, demo/live backend pill, role switcher (`kabir` Sales, `meera` Marketing, `rohan` Product, `dev` Ops Admin), avatar.
3. **Main column**:
   - `OverviewHeader`: serif greeting for the current role, weekly pills, 4 KPI cards (graph health sparkline, MTTR, order SLA, agent/human action bars).
   - `DecisionCards`: the 4 scenarios (`rootcause`, `surge`, `checkout`, `access`) as "Needs your decision" cards (`role="tab"` primary buttons).
   - `CompanyGraph`: `react-force-graph-2d` on a dotted cream canvas — ink/olive/orange/violet flat nodes, orange traversal path and particles, red stale/denied states, Geist Mono label pills.
   - `PulseFeed`: live feed of scenario results, then the footer.
4. **Assistant column (`AssistantPanel`)**: serif "Ask anything…" intro, prompt cards, query input (`⌘K` focuses `.assistant-input input`), `AnswerDock` synthesis, and `XRayInspector` ("Graph proof": hop trace, selected entity, Cypher, diagnostics).

Below 1080px the assistant stacks under the main column; below 760px the rail hides and the grids collapse.

---

## 6. Graph Data Model & Entity Topology (`src/data/mockCompany.js`)

The graph model represents a quick-commerce operational topology:

### Node Types (`type`)
- **System**: Microservices and technical services (`sys-inv`, `sys-pricing`, `sys-cart`, `sys-checkout`, `sys-dispatch`, `sys-payout`).
- **Store**: Physical dark-store facilities (`store-delhi-04`, `store-delhi-02`).
- **Doc**: Policy runbooks, SLAs, and PRDs (`doc-01`, `doc-02` [Stale cold-chain policy], `doc-03`).
- **Ticket**: Jira / Linear operational incidents (`LIN-101` [Freezer outage], `LIN-104`, `LIN-202`, `LIN-205`, `LIN-309`).
- **Decision**: Historical and active governance decisions (`mem-01` [Stale ₹30 surge], `mem-02` [Active ₹50 surge]).
- **Team**: Organizational units (`team-ops`, `team-eng`, `team-mkt`, `team-leadership`).
- **Person**: Team members and on-call owners (`user-meera`, `user-dev`, `user-rohan`, `user-aarav`, `user-kabir`).

### Relationship Types (`label`)
- `DEPENDS_ON`: Direct service-to-service or store-to-service dependency.
- `MAINTAINS`: Team or person ownership of a service or system.
- `DOCUMENTS`: Runbook or policy documentation relationship.
- `MODIFIES`: Action or decision changing system behavior.
- `SUPERSEDES`: Temporal edge indicating a new policy replaces an older one.
- `ROOT_CAUSE_FOUND`: Diagnostic edge pointing to the source incident.
- `MEMBER_OF`: Organizational reporting hierarchy.

---

## 7. Backend Contracts & Fallback Adapter (`src/services/companyBrainApi.js`)

When a backend is running at `VITE_API_BASE_URL` (default `http://localhost:8000`), the client invokes the following endpoints:

| Action | HTTP Request | Description |
| :--- | :--- | :--- |
| **Load Graph** | `GET /graph` | Fetches complete company node and edge graph. |
| **Root Cause** | `POST /simulate/shortest-path` | Calculates shortest causal path between alert and origin. |
| **Surge Update** | `POST /simulate/surge-update` | Returns updated surge decision and stale doc blast radius. |
| **Smart Delegate**| `POST /simulate/delegate-p0` | Recommends on-call owner based on graph author topology. |
| **RBAC Check** | `POST /simulate/rbac-check` | Validates user role against target entity permissions. |
| **Natural Query**| `POST /query` | Translates natural language question into Cypher and returns grounded answer. |

If the FastAPI service returns a network error or is not running, `companyBrainApi.js` automatically returns the deterministic mock data matching the same contract schema, guaranteeing zero UI failure during client demos or offline use.

---

## 8. Guidelines for Future AI / Claude Contributions

When contributing to this repository, observe the following rules:

1. **Preserve Operational Dashboard & Backend Contracts**:
   - Never remove or break `/app` (`OperationalWorkspace`), the 4 simulation scenarios, the role selector, or the `companyBrainApi.js` fallback contracts.
   - Maintain stable node IDs (`sys-inv`, `LIN-101`, `user-meera`, `doc-02`) across any data additions.
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

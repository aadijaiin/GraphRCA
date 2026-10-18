# GraphRCA — Graph-Powered Company Brain for Quick-Commerce Operations

GraphRCA turns distributed operational knowledge into an explainable, living graph. Every decision has a path. Every action has evidence.

This repository contains:
1. **The Editorial Marketing Landing Page (`/`)**: A high-fidelity recreation of the **Antimetal** editorial technology aesthetic combined with **Beautiful UI** interactive agent workflow animations.
2. **The Investigation Workbench (`/app`)**: the live product UI on top of the FastAPI + FalkorDB backend. Pick an alert, run the multi-agent investigation live (SSE) or replay the recorded run, and watch every tool call light up the graph until the cited answer arrives.

> **AI Assistants / Claude**: See [`CLAUDE.md`](./CLAUDE.md) for full architectural context, design tokens, data models, component hierarchy, and implementation rules.

---

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Start the backend on :8000 (see ../docs/RUNBOOK.md), then the dev server; /api is proxied to it
npm run dev

# 3. Production build (FastAPI serves dist/ in the Docker image)
npm run build
```

The application runs locally at `http://localhost:5173`.

---

## Navigation & Routes

- **`/`**: The GraphRCA Marketing Landing Page
  - **Hero**: Radial knowledge network with Canvas 2D simulation and live leader pills.
  - **The Complexity Gap**: Custom responsive vector diagram of the Representational Gap and editorial essay.
  - **System Architecture**: Layered 4-tier isometric wireframe SVG diagram and editorial narrative.
  - **Product Showcase**: 3-region desktop application canvas preview with interactive AI prompts.
  - **Specialized Agents & Workflow**: 5 capability panels and 7-stage Beautiful UI workflow with synchronized topological graph trace.
  - **FAQ**: 6 accessible accordion questions on graph grounding, causality, and production connectors.
  - **Research Log**: 3 technical papers with custom engineering SVGs (DAG Cypher traversal, cryptographic provenance envelope, temporal graph drift).
  - **Final CTA & Minimal Editorial Footer**: Dual conversion buttons and structured link matrix.
- **`/app`** (or `#app`): the Investigation Workbench
  - Alert cards from `/api/alerts`: **Investigate** runs live, **Replay** plays `public/runs/ALT-001.json`.
  - Model picker in the top bar (server default, scripted, claude, local).
  - Company graph from `/api/graph`; nodes and edges the agents touch light up, hover a timeline step to see what it touched.
  - Cited answer with root cause, amplifier, source messages and findings; memories written for next time.
  - Deep link: `/?alert=ALT-001&mode=replay` (or `/app?alert=…`). `← Overview` returns to the landing page.

---

## Tech Stack

- **Frontend**: React 19, Vite 8
- **Graph Visualization**: `react-force-graph-2d` (d3-force physics)
- **Icons**: `lucide-react`
- **Styling**: Single unified design system in `src/styles.css` using CSS custom properties (`--bb-*`), Newsreader serif, Geist and Geist Mono.
- **Backend**: the FastAPI app in `../backend`; event contract in `../docs/events.md`.

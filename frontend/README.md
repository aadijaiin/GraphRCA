# BlinkBrain — Graph-Powered Company Brain for Quick-Commerce Operations

BlinkBrain turns distributed operational knowledge into an explainable, living graph. Every decision has a path. Every action has evidence.

This repository contains:
1. **The Editorial Marketing Landing Page (`/`)**: A high-fidelity recreation of the **Antimetal** editorial technology aesthetic combined with **Beautiful UI** interactive agent workflow animations.
2. **The Operational Explainability Lab (`/app`)**: An interactive operational workbench with live force-directed graph exploration (`react-force-graph-2d`), 4 incident simulation scenarios, role-based access control, an X-Ray hop inspector, and natural-language QA grounded in Cypher queries.

> **AI Assistants / Claude**: See [`CLAUDE.md`](./CLAUDE.md) for full architectural context, design tokens, data models, component hierarchy, and implementation rules.

---

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (optional, defaults to http://localhost:8000 for backend)
cp .env.example .env.local

# 3. Start local development server
npm run dev

# 4. Production build
npm run build
```

The application runs locally at `http://localhost:5173`.

---

## Navigation & Routes

- **`/`**: The BlinkBrain Marketing Landing Page
  - **Hero**: Radial knowledge network with Canvas 2D simulation and live leader pills.
  - **The Complexity Gap**: Custom responsive vector diagram of the Representational Gap and editorial essay.
  - **System Architecture**: Layered 4-tier isometric wireframe SVG diagram and editorial narrative.
  - **Product Showcase**: 3-region desktop application canvas preview with interactive AI prompts.
  - **Specialized Agents & Workflow**: 5 capability panels and 7-stage Beautiful UI workflow with synchronized topological graph trace.
  - **FAQ**: 6 accessible accordion questions on graph grounding, causality, and production connectors.
  - **Research Log**: 3 technical papers with custom engineering SVGs (DAG Cypher traversal, cryptographic provenance envelope, temporal graph drift).
  - **Final CTA & Minimal Editorial Footer**: Dual conversion buttons and structured link matrix.
- **`/app`** (or `#app`): The Operational Explainability Lab
  - Switch between 4 incident simulation scenarios (`rootcause`, `surge`, `drift`, `policy`).
  - View-as role switcher (`Dev`, `Ops Lead`, `Marketing Lead`, `Sales`).
  - Synchronized X-Ray inspector with hop-by-hop latency and Cypher query viewer.
  - Click `← Overview` in the top header to return to the landing page.

---

## Tech Stack

- **Frontend**: React 18, Vite 6
- **Graph Visualization**: `react-force-graph-2d` (d3-force physics)
- **Icons**: `lucide-react`
- **Styling**: Single unified design system in `src/styles.css` using CSS custom properties (`--bb-*`), Newsreader serif, Plus Jakarta Sans, and DM Mono.
- **Backend Connector**: FastAPI client (`src/services/companyBrainApi.js`) with automatic deterministic fallback if the backend service is offline.

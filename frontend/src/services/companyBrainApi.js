import { links as mockLinks, nodes as mockNodes, scenarios } from '../data/mockCompany.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const layoutById = Object.fromEntries(mockNodes.map((node) => [node.id, node]));
const mockGraph = {
  nodes: mockNodes.map((node) => ({ ...node })),
  links: mockLinks.map(([source, target, label]) => ({ source, target, label })),
};

function mapGraphPayload(payload) {
  if (!payload || !Array.isArray(payload.nodes) || !Array.isArray(payload.links)) return null;
  const apiNodes = payload.nodes.map((raw, index) => {
    const seeded = layoutById[raw.id];
    const angle = (index / Math.max(payload.nodes.length, 1)) * Math.PI * 2;
    const radius = 120 + (index % 4) * 40;
    return {
      ...(seeded || {}),
      ...raw,
      id: String(raw.id),
      label: raw.label || raw.id,
      type: raw.type || seeded?.type || 'System',
      x: seeded?.x ?? 450 + Math.cos(angle) * radius,
      y: seeded?.y ?? 285 + Math.sin(angle) * radius,
      restricted: raw.restricted ?? seeded?.restricted ?? false,
      meta: seeded?.meta || raw.label || raw.id,
      owner: seeded?.owner || raw.role || 'Connected entity',
    };
  });
  const ids = new Set(apiNodes.map((node) => node.id));
  const apiLinks = payload.links
    .filter((link) => ids.has(String(link.source)) && ids.has(String(link.target)))
    .map((link) => ({ source: String(link.source), target: String(link.target), label: link.label || link.type || 'RELATED_TO' }));
  return { nodes: apiNodes, links: apiLinks };
}

export async function fetchCompanyGraph(tenant = 'dashmart') {
  try {
    let response = await fetch(`${API_BASE_URL}/api/graph?tenant=${tenant}`, { signal: AbortSignal.timeout(1800) }).catch(() => null);
    if (!response || !response.ok) {
      response = await fetch(`http://localhost:8000/api/graph?tenant=${tenant}`, { signal: AbortSignal.timeout(1500) }).catch(() => null);
    }
    if (!response || !response.ok) {
      response = await fetch(`${API_BASE_URL}/graph`, { signal: AbortSignal.timeout(1200) });
    }
    if (!response.ok) throw new Error(`Graph API returned ${response.status}`);
    return mapGraphPayload(await response.json());
  } catch {
    return null;
  }
}

const endpointByScenario = {
  surge: '/simulate/surge-update',
  checkout: '/simulate/delegate-p0',
  access: '/simulate/rbac-check',
  rootcause: '/simulate/shortest-path',
};

export async function runCompanyScenario(scenario, currentRole) {
  const endpoint = endpointByScenario[scenario.id];
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: scenario.id === 'access' ? JSON.stringify({ user_id: currentRole.backendId }) : undefined,
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) throw new Error(`Simulation API returned ${response.status}`);
    const payload = await response.json();
    const graphData = await fetchCompanyGraph();
    const activePath = Array.isArray(payload.active_path_ids) ? payload.active_path_ids.map(String) : scenario.path;
    const staleDocs = graphData
      ? graphData.nodes.filter((node) => node.type === 'Doc' && node.status === 'STALE').map((node) => node.id)
      : scenario.stale;
    const runtime = {
      title: payload.title || scenario.title,
      summary: payload.agent_summary || scenario.summary,
      answer: payload.agent_summary || scenario.answer,
      cypher: payload.cypher_used || scenario.cypher,
      path: activePath,
      severity: scenario.id === 'access' ? (payload.blocked ? 'SECURITY' : 'AUTHORIZED') : scenario.severity,
      blocked: Boolean(payload.blocked),
    };
    return {
      backendMode: 'live', scenarioId: scenario.id, activePath,
      hops: scenario.hops, staleDocs, feedItem: { ...scenario.feed, id: `feed-${Date.now()}`, time: 'just now' },
      graphData, runtime,
    };
  } catch (error) {
    // The prototype remains demoable before the API is running. Once the API is reachable,
    // the same controls call the real FalkorDB-backed endpoints above.
    const activePath = scenario.path;
    return {
      backendMode: 'mock', scenarioId: scenario.id, activePath,
      hops: scenario.hops, staleDocs: scenario.stale,
      feedItem: { ...scenario.feed, id: `feed-${Date.now()}`, time: 'just now' },
      graphData: null, runtime: null, fallbackReason: error?.message || 'API unavailable',
    };
  }
}

export async function askCompanyBrain(question, scenario) {
  // The previous backend plan defines event endpoints but not a general question endpoint yet.
  // Until one is agreed, keep Q&A deterministic and visibly grounded in the selected scenario.
  await new Promise((resolve) => window.setTimeout(resolve, 180));
  if (!question.trim()) return null;
  return { question, answer: scenario.answer, path: scenario.path, hops: scenario.hops, source: 'Scenario evidence · demo adapter' };
}

export const initialMockGraph = mockGraph;

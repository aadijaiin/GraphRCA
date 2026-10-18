import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import {
  Play, Pause, RotateCcw, ChevronRight, ChevronDown, Check, CheckCircle2,
  AlertTriangle, ShieldCheck, ShieldAlert, Cpu, Sparkles, Terminal,
  ExternalLink, Layers, ArrowRight, Eye, Clock, Database, Code2,
  Boxes, Users, FileText, GitBranch, Zap, Flame, RefreshCw, Activity,
  Maximize2, ArrowUpRight
} from 'lucide-react';
import { nodes as mockNodes, links as mockLinks } from '../data/mockCompany.js';

// Obsidian Canvas 3D Sphere Themes
const SPHERE_THEMES = {
  system: { light: '#7dd3fc', base: '#0ea5e9', shadow: '#0369a1', rim: '#082f49', glow: 'rgba(14, 165, 233, 0.45)', labelAccent: '#38bdf8' },
  decisionActive: { light: '#6ee7b7', base: '#10b981', shadow: '#047857', rim: '#022c22', glow: 'rgba(16, 185, 129, 0.45)', labelAccent: '#34d399' },
  decisionSuperseded: { light: '#94a3b8', base: '#475569', shadow: '#334155', rim: '#0f172a', glow: 'rgba(100, 116, 139, 0.25)', labelAccent: '#94a3b8' },
  ticket: { light: '#fde68a', base: '#f59e0b', shadow: '#b45309', rim: '#451a03', glow: 'rgba(245, 158, 11, 0.45)', labelAccent: '#fbbf24' },
  staleDoc: { light: '#fca5a5', base: '#ef4444', shadow: '#b91c1c', rim: '#450a0a', glow: 'rgba(239, 68, 68, 0.50)', labelAccent: '#f87171' },
  doc: { light: '#ddd6fe', base: '#a78bfa', shadow: '#6d28d9', rim: '#2e1065', glow: 'rgba(167, 139, 250, 0.40)', labelAccent: '#c4b5fd' },
  silverWhite: { light: '#ffffff', base: '#cbd5e1', shadow: '#64748b', rim: '#1e293b', glow: 'rgba(203, 213, 225, 0.35)', labelAccent: '#e2e8f0' },
  restricted: { light: '#fecdd3', base: '#e11d48', shadow: '#881337', rim: '#2c0b14', glow: 'rgba(225, 29, 72, 0.50)', labelAccent: '#fda4af' },
};

function getNodeTheme(node, isStale) {
  if (node.type === 'Doc') return isStale || node.status === 'STALE' ? SPHERE_THEMES.staleDoc : SPHERE_THEMES.doc;
  if (node.type === 'Decision') return node.status === 'SUPERSEDED' ? SPHERE_THEMES.decisionSuperseded : SPHERE_THEMES.decisionActive;
  if (node.type === 'System') return node.restricted ? SPHERE_THEMES.restricted : SPHERE_THEMES.system;
  if (node.type === 'Ticket') return SPHERE_THEMES.ticket;
  return SPHERE_THEMES.silverWhite;
}

function pairKey(a, b) {
  return [String(a), String(b)].sort().join('::');
}

function getNodeId(value) {
  return typeof value === 'object' ? value?.id : value;
}

// -------------------------------------------------------------
// WORKFLOW SCENARIO DEFINITIONS (7 STAGES EACH)
// -------------------------------------------------------------
export const WORKFLOW_SCENARIOS = {
  coldchain: {
    id: 'coldchain',
    badge: 'INCIDENT EVT-8821',
    category: 'COLD-CHAIN FAILURE & CAMPAIGN CONFLICT',
    title: 'Freezer outage cascades into scheduled promotion',
    agent: 'Autonomous Triage Agent · v1.4',
    model: 'FalkorDB Graph Reasoner',
    initialEventText: 'CRITICAL: South Delhi Dark Store #04 reports cold-chain freezer temperature anomaly (4.2°C → 18.5°C).',
    targetLabScenario: 'rootcause',
    stages: [
      {
        index: 0,
        number: '01',
        name: 'Event detected',
        short: 'Event Ingestion',
        badge: 'TELEMETRY ANOMALY',
        tool: 'telemetry.ingest_iot_alert(sensor="frz-04", store="delhi-central")',
        duration: '1.2ms',
        summary: 'IoT cold-chain telemetry triggers an automated anomaly event. South Delhi Dark Store #4 freezer temperature exceeded the critical 5.0°C threshold.',
        thought: 'Ingesting high-priority sensor alert from IoT broker. Validating device signature and locating primary inventory synchronization service in company graph.',
        activeNodes: ['sys-inv', 'LIN-101'],
        activeEdges: [['LIN-101', 'sys-inv']],
        evidence: [
          { id: 'sys-inv', label: 'NCR Freezer Sync', type: 'System', role: 'Affected Service', detail: 'Dark-store capacity throttled to 12%' },
          { id: 'LIN-101', label: 'LIN-101 Freezer Outage', type: 'Ticket', role: 'Telemetry Alert', detail: 'Hardware breaker tripped at 11:42 PM' },
        ],
        rawTelemetry: '{\n  "event_id": "EVT-8821",\n  "sensor": "frz-04",\n  "temp_celsius": 18.5,\n  "threshold": 5.0,\n  "status": "HARDWARE_CAP_ACTIVE",\n  "target_service": "sys-inv"\n}',
      },
      {
        index: 1,
        number: '02',
        name: 'Graph traversal',
        short: 'Cypher Traversal',
        badge: 'CAUSALITY DISCOVERY',
        tool: 'falkordb.cypher_traverse(depth=3, directed=false)',
        duration: '4.8ms',
        summary: 'GraphRCA traverses outward from NCR Freezer Sync across microservice and organizational boundaries, discovering a direct dependency on an active marketing campaign.',
        thought: 'Executing shortestPath query in FalkorDB. Discovered path connects infrastructure outage through campaign documentation DOC-02 directly to Marketing lead Meera Nair.',
        activeNodes: ['sys-inv', 'doc-02', 'user-meera', 'team-mkt'],
        activeEdges: [['doc-02', 'sys-inv'], ['team-mkt', 'doc-02'], ['user-meera', 'team-mkt']],
        evidence: [
          { id: 'doc-02', label: 'Amul Ice-Cream Flash Ad', type: 'Doc', role: 'Downstream Consumer', detail: 'Push notification scheduled in 15 mins' },
          { id: 'user-meera', label: 'Meera Nair · Growth', type: 'Person', role: 'Campaign Owner', detail: 'Marketing Manager for NCR Region' },
          { id: 'team-mkt', label: 'Marketing Team', type: 'Team', role: 'Department', detail: 'Maintains DOC-02 campaign budget' },
        ],
        rawTelemetry: 'MATCH (start:Person {id:"user-meera"}), (end:Ticket {id:"LIN-101"})\nMATCH p = shortestPath((start)-[*..4]-(end))\nRETURN [n IN nodes(p) | n.id] AS path_ids,\n       [r IN relationships(p) | type(r)] AS relations\n// Result: 4 hops traversed in 4.8ms',
      },
      {
        index: 2,
        number: '03',
        name: 'Permission validation',
        short: 'RBAC Security Gate',
        badge: 'POLICY EVALUATION',
        tool: 'auth.evaluate_rbac_policy(caller="user-meera", scope="operations")',
        duration: '0.9ms',
        summary: 'The agent verifies caller permissions against graph security policies. Growth team read access is confirmed for inventory state; sensitive payout ledgers are isolated.',
        thought: 'Evaluating RBAC boundary. Caller possesses standard Marketing credentials. Inventory status is permitted. Rider compensation ledger (sys-payout) remains masked.',
        activeNodes: ['user-meera', 'team-mkt', 'sys-inv', 'sys-payout'],
        activeEdges: [['team-mkt', 'sys-inv'], ['team-ops', 'sys-payout']],
        evidence: [
          { id: 'user-meera', label: 'Meera Nair · Marketing', type: 'Person', role: 'Standard Access', detail: 'Authorized for Store & Inventory state' },
          { id: 'sys-payout', label: 'Rider Payout Ledger', type: 'System', role: 'Security Boundary', detail: '403 Forbidden · Ledger masked' },
        ],
        rawTelemetry: '{\n  "caller": "user-meera",\n  "role": "Marketing",\n  "required_scope": "ops.telemetry.read",\n  "evaluation": "PERMITTED",\n  "redacted_subgraphs": ["sys-payout", "doc-04"]\n}',
      },
      {
        index: 3,
        number: '04',
        name: 'Evidence assembled',
        short: 'Provenance Proof',
        badge: 'AUDIT CHAIN SEALED',
        tool: 'graph.synthesize_provenance(path_ids=["LIN-101", "sys-inv", "doc-02"])',
        duration: '3.1ms',
        summary: 'Relevant graph entities and source documents are assembled into an immutable evidence chain. The causal relationship between freezer capacity and campaign failure is verified.',
        thought: 'Synthesizing evidence artifacts into cryptographic proof envelope. Cross-referencing SLA clauses in DOC-02 with active capacity cap in LIN-101.',
        activeNodes: ['LIN-101', 'sys-inv', 'doc-02'],
        activeEdges: [['LIN-101', 'sys-inv'], ['doc-02', 'sys-inv']],
        evidence: [
          { id: 'LIN-101', label: 'LIN-101 Ticket', type: 'Ticket', role: 'Root Cause', detail: 'Freezer capacity throttled to 12%' },
          { id: 'doc-02', label: 'Campaign Plan DOC-02', type: 'Doc', role: 'Violated Precondition', detail: 'Clause 4.2 requires >80% store readiness' },
        ],
        rawTelemetry: 'PROVENANCE CHAIN:\n[LIN-101 (Outage)] --MODIFIES--> [sys-inv (Freezer Sync)]\n  ^-- Violated Precondition\n[DOC-02 (Campaign)] --DOCUMENTS--> [sys-inv]\nStatus: Verified (Deterministic Mathematical Path)',
      },
      {
        index: 4,
        number: '05',
        name: 'Impact identified',
        short: 'Blast Radius',
        badge: 'IMPACT ASSESSMENT',
        tool: 'impact.simulate_blast_radius(campaign="amul-flash", dark_store="delhi-04")',
        duration: '2.4ms',
        summary: 'GraphRCA projects the operational blast radius: 12,400 customers queued to receive push notifications for unavailable inventory, risking an 84% cancellation rate.',
        thought: 'Computing customer impact matrix. 12,400 push notifications scheduled in 12 minutes. Projected delivery SLA failures: 84%. Ad spend at risk: ₹2,40,000.',
        activeNodes: ['doc-02', 'user-meera', 'sys-inv'],
        activeEdges: [['doc-02', 'sys-inv'], ['team-mkt', 'doc-02']],
        evidence: [
          { id: 'doc-02', label: '12,400 Push Notifications', type: 'Doc', role: 'Imminent Blast', detail: 'Scheduled in 12 mins' },
          { id: 'sys-inv', label: '84% SLA Breach Risk', type: 'System', role: 'Projected Fallout', detail: '₹2.4L ad budget wasted' },
        ],
        rawTelemetry: '{\n  "blast_radius": {\n    "dark_store": "STORE-DELHI-04",\n    "affected_users": 12400,\n    "projected_cancellations": "84%",\n    "wasted_ad_spend": "₹2,40,000",\n    "severity": "CRITICAL"\n  }\n}',
      },
      {
        index: 5,
        number: '06',
        name: 'Action proposed',
        short: 'Agent Recommendation',
        badge: 'MITIGATION PROPOSAL',
        tool: 'agent.propose_mitigation(confidence=0.98, urgency="IMMEDIATE")',
        duration: '1.8ms',
        summary: 'The agent formulates a verified multi-team mitigation plan: auto-pause the push notification, notify Meera Nair via Slack, and reroute dark-store replenishment to South Delhi backup.',
        thought: 'Drafting deterministic remediation proposal. Automated action payload generated for Marketing push gateway and Linear dispatcher.',
        activeNodes: ['user-meera', 'team-mkt', 'user-dev', 'team-ops'],
        activeEdges: [['user-meera', 'team-mkt'], ['user-dev', 'team-ops']],
        evidence: [
          { id: 'user-meera', label: 'Pause Push Campaign', type: 'Person', role: 'Automated Action', detail: 'Stop dispatch to Delhi-04 zone' },
          { id: 'user-dev', label: 'Notify Ops Lead Dev', type: 'Person', role: 'Dispatch Reroute', detail: 'Switch inventory to South Delhi hub' },
        ],
        rawTelemetry: 'ACTION DISPATCH:\n1. POST /api/campaigns/doc-02/pause?geo=delhi-central\n2. SLACK #ops-incident-alerts: "Meera Nair: Campaign DOC-02 paused due to LIN-101 freezer cap."\n3. LINEAR: Reroute replenishment to STORE-DELHI-SOUTH.',
      },
      {
        index: 6,
        number: '07',
        name: 'Outcome verified',
        short: 'Decision Sealed',
        badge: 'ZERO HALLUCINATION',
        tool: 'ledger.seal_decision_proof(hash="0x9f4a...e312", latency="11.4ms")',
        duration: '11.4ms',
        summary: 'The incident is resolved with full mathematical provenance. 12,400 order cancellations were prevented, and the verifiable decision audit trail was permanently logged into FalkorDB.',
        thought: 'Execution complete. Decision proof hash committed to audit ledger. Zero hallucination guarantee satisfied. Entire lifecycle executed in 11.4ms total latency.',
        activeNodes: ['LIN-101', 'sys-inv', 'doc-02', 'user-meera', 'user-dev'],
        activeEdges: [['LIN-101', 'sys-inv'], ['doc-02', 'sys-inv'], ['user-meera', 'team-mkt'], ['user-dev', 'team-ops']],
        evidence: [
          { id: 'LIN-101', label: '12,400 Orders Protected', type: 'Ticket', role: 'Verified Outcome', detail: 'Push notification safely withheld' },
          { id: 'doc-02', label: 'Mathematical Proof Hash', type: 'Doc', role: 'Audit Ledger', detail: 'SHA-256: 0x9f4a8b12...e312' },
        ],
        rawTelemetry: 'VERIFICATION CERTIFICATE:\nIncident: EVT-8821\nStatus: RESOLVED_WITHOUT_BREACH\nTotal Traversal Latency: 11.4ms\nAudit Proof Hash: 0x9f4a8b12e312c984\nFalkorDB Consistency: DETERMINISTIC_TRUE',
      },
    ],
  },

  surge: {
    id: 'surge',
    badge: 'POLICY DRIFT MEM-02',
    category: 'DYNAMIC PRICING & STALE SOP',
    title: 'Surge rule update invalidates partner documentation',
    agent: 'Temporal Drift Sentinel · v2.1',
    model: 'FalkorDB Temporal Engine',
    initialEventText: 'RULE CHANGE: Rain surge threshold raised from ₹30 to ₹50 following monsoon capacity spike.',
    targetLabScenario: 'surge',
    stages: [
      {
        index: 0,
        number: '01',
        name: 'Event detected',
        short: 'Rule Transition',
        badge: 'POLICY SUPERSEDED',
        tool: 'pricing.ingest_rule_commit(ticket="LIN-104", rule="MEM-02")',
        duration: '0.8ms',
        summary: 'Linear ticket LIN-104 completes: Product lead Aarav Mehta updates peak rain surge cap from ₹30 to ₹50, activating memory rule MEM-02.',
        thought: 'Ingesting rule change from deployment pipeline. New policy MEM-02 supersedes historical threshold MEM-01.',
        activeNodes: ['LIN-104', 'sys-surge', 'mem-02'],
        activeEdges: [['LIN-104', 'sys-surge'], ['mem-02', 'sys-surge']],
        evidence: [
          { id: 'LIN-104', label: 'LIN-104 Surge Update', type: 'Ticket', role: 'Triggering Ticket', detail: 'Closed by Aarav Mehta' },
          { id: 'mem-02', label: 'MEM-02 (₹50 Max Surge)', type: 'Decision', role: 'Active Rule', detail: 'Supersedes ₹30 threshold' },
        ],
        rawTelemetry: 'MERGE (current:Decision {id:"mem-02", max_fee: 50})\nMERGE (old:Decision {id:"mem-01", max_fee: 30})\nMERGE (current)-[:SUPERSEDES]->(old)\nRETURN current, old',
      },
      {
        index: 1,
        number: '02',
        name: 'Graph traversal',
        short: 'Downstream Scan',
        badge: 'DEPENDENCY CRAWL',
        tool: 'falkordb.scan_downstream_docs(system="sys-surge")',
        duration: '3.6ms',
        summary: 'GraphRCA traverses downstream edges connected to Surge Pricing Engine, identifying runbooks and sales SLAs that cite the superseded ₹30 threshold.',
        thought: 'Scanning all Doc nodes connected to sys-surge via DOCUMENTS and REFERENCES relationships. Detecting stale parameters.',
        activeNodes: ['sys-surge', 'mem-01', 'doc-01', 'doc-03'],
        activeEdges: [['mem-01', 'sys-surge'], ['doc-01', 'sys-surge'], ['doc-03', 'sys-surge']],
        evidence: [
          { id: 'doc-01', label: 'Monsoon Surge SOP', type: 'Doc', role: 'Contradictory Doc', detail: 'Contains outdated ₹30 reference' },
          { id: 'doc-03', label: 'FMCG Hero Banner SLA', type: 'Doc', role: 'Partner Contract', detail: 'Guarantees delivery caps to brand partners' },
        ],
        rawTelemetry: 'MATCH (s:System {id:"sys-surge"})<-[:DOCUMENTS]-(doc:Doc)\nRETURN doc.id, doc.label, doc.status\n// Found: DOC-01 (Internal SOP) & DOC-03 (Partner SLA)',
      },
      {
        index: 2,
        number: '03',
        name: 'Permission validation',
        short: 'Contract Boundary',
        badge: 'LEGAL SCOPE CHECK',
        tool: 'auth.evaluate_contract_scope(caller="team-sales", document="DOC-03")',
        duration: '1.1ms',
        summary: 'The agent inspects organizational access rights: Sales lead Kabir Sharma has authority to inspect partner SLAs, but cannot unilaterally modify pricing algorithms.',
        thought: 'Verifying permissions across Sales and Operations boundary. Contract commitments require cross-functional sign-off.',
        activeNodes: ['user-kabir', 'team-sales', 'doc-03', 'sys-surge'],
        activeEdges: [['user-kabir', 'team-sales'], ['team-sales', 'doc-03']],
        evidence: [
          { id: 'user-kabir', label: 'Kabir Sharma · Sales', type: 'Person', role: 'Partner Owner', detail: 'Authorized for DOC-03 review' },
          { id: 'team-sales', label: 'Sales Department', type: 'Team', role: 'SLA Signatory', detail: 'Bound by FMCG partner agreements' },
        ],
        rawTelemetry: '{\n  "caller": "user-kabir",\n  "team": "Sales",\n  "target": "doc-03",\n  "permission": "READ_AND_PROPOSE_AMENDMENT",\n  "engine_mod_allowed": false\n}',
      },
      {
        index: 3,
        number: '04',
        name: 'Evidence assembled',
        short: 'Semantic Diff',
        badge: 'DRIFT PROVEN',
        tool: 'diff.synthesize_policy_drift(old="MEM-01", current="MEM-02", docs=["DOC-01", "DOC-03"])',
        duration: '2.9ms',
        summary: 'The agent builds a visual diff between the running pricing engine code and the legacy text documentation, proving that the runbooks are now materially out of date.',
        thought: 'Constructing semantic drift report. Concrete numerical mismatch found: Code applies ₹50 fee; Documentation promises ₹30 maximum fee.',
        activeNodes: ['mem-02', 'mem-01', 'doc-01', 'doc-03'],
        activeEdges: [['mem-02', 'mem-01'], ['doc-01', 'sys-surge'], ['doc-03', 'sys-surge']],
        evidence: [
          { id: 'mem-02', label: 'Code Truth: ₹50', type: 'Decision', role: 'Live Engine Rule', detail: 'Active in Surge Pricing Microservice' },
          { id: 'doc-01', label: 'Doc Claim: ₹30', type: 'Doc', role: 'Stale Runbook', detail: 'Contradicts production runtime' },
        ],
        rawTelemetry: 'DIFF REPORT:\n- doc-01.clause_7: "Maximum rain surcharge is ₹30"\n+ sys-surge.rule_mem_02: "Maximum rain surcharge is ₹50"\nSTATUS: KNOWLEDGE_DRIFT_CONFIRMED',
      },
      {
        index: 4,
        number: '05',
        name: 'Impact identified',
        short: 'Partner Exposure',
        badge: 'COMPLIANCE RISK',
        tool: 'compliance.evaluate_contractual_exposure(partners=14, doc="DOC-03")',
        duration: '2.1ms',
        summary: 'Impact analysis reveals that 14 FMCG brand partners could claim contract violation penalties if rain fees exceeding ₹30 are charged during peak delivery slots.',
        thought: 'Cross-referencing active brand commitments with billing logs. Identified ₹1,80,000 potential partner credit clawback risk.',
        activeNodes: ['doc-03', 'team-sales', 'user-kabir'],
        activeEdges: [['team-sales', 'doc-03'], ['user-kabir', 'team-sales']],
        evidence: [
          { id: 'doc-03', label: '14 Partner Contracts', type: 'Doc', role: 'Legal Exposure', detail: 'FMCG delivery cap guarantees' },
          { id: 'team-sales', label: '₹1.8L Clawback Risk', type: 'Team', role: 'Financial Impact', detail: 'Overcharge indemnity clause' },
        ],
        rawTelemetry: '{\n  "affected_sla": "DOC-03",\n  "partner_accounts": 14,\n  "potential_clawback": "₹1,80,000",\n  "remedy": "UPDATE_SLA_OR_WHITELIST_PARTNERS"\n}',
      },
      {
        index: 5,
        number: '06',
        name: 'Action proposed',
        short: 'Auto-Invalidate',
        badge: 'RUNBOOK INVALIDATION',
        tool: 'knowledge.mark_stale_and_draft_patch(docs=["DOC-01", "DOC-03"])',
        duration: '1.9ms',
        summary: 'The agent flags DOC-01 and DOC-03 as STALE across all company dashboards and drafts an automated Notion update with an executive summary for Kabir and Dev.',
        thought: 'Injecting STALE metadata state into FalkorDB. Generating GitHub PR draft for Monsoon Runbook update.',
        activeNodes: ['doc-01', 'doc-03', 'team-ops', 'team-sales'],
        activeEdges: [['team-ops', 'doc-01'], ['team-sales', 'doc-03']],
        evidence: [
          { id: 'doc-01', label: 'Flagged as STALE', type: 'Doc', role: 'Warning Broadcast', detail: 'Visible to all dark-store operators' },
          { id: 'doc-03', label: 'Drafted SLA Addendum', type: 'Doc', role: 'Partner Notice', detail: 'Pre-formatted notification for Sales' },
        ],
        rawTelemetry: 'MATCH (d:Doc) WHERE d.id IN ["doc-01", "doc-03"]\nSET d.status = "STALE", d.stale_reason = "MEM-02 supersession"\nRETURN d.id, d.status',
      },
      {
        index: 6,
        number: '07',
        name: 'Outcome verified',
        short: 'Knowledge Synchronized',
        badge: 'ZERO DRIFT',
        tool: 'audit.commit_temporal_alignment(hash="0x4b7c...a901")',
        duration: '9.8ms',
        summary: 'Company knowledge base and production microservices are once again synchronized. Zero contradictory runbooks remain active in operations.',
        thought: 'Audit trail sealed. Documentation state matches engine truth. Drift resolved in 9.8ms total execution time.',
        activeNodes: ['sys-surge', 'mem-02', 'doc-01', 'doc-03', 'LIN-104'],
        activeEdges: [['mem-02', 'sys-surge'], ['doc-01', 'sys-surge'], ['doc-03', 'sys-surge']],
        evidence: [
          { id: 'mem-02', label: 'Unified Truth (₹50)', type: 'Decision', role: 'Synchronized State', detail: 'No conflicting definitions remain' },
          { id: 'doc-01', label: 'Audit Proof Hash', type: 'Doc', role: 'Immutable Ledger', detail: 'SHA-256: 0x4b7ca901...f321' },
        ],
        rawTelemetry: 'DRIFT RESOLUTION CERTIFICATE:\nPolicy: MEM-02 (₹50 Monsoon Peak)\nFlagged Stale Docs: DOC-01, DOC-03\nStatus: SYNCHRONIZED_IN_GRAPH\nFalkorDB Temporal Validity: 100%',
      },
    ],
  },

  checkout: {
    id: 'checkout',
    badge: 'P0 INCIDENT LIN-309',
    category: 'CHECKOUT PROMO CRASH & DELEGATION',
    title: 'Unassigned checkout crash routed by historical resolution graph',
    agent: 'Incident Delegation Sentinel · v1.9',
    model: 'FalkorDB Expertise Engine',
    initialEventText: 'P0 CRITICAL: Cart promo checkout crash reported during evening peak. Zero assigned engineers.',
    targetLabScenario: 'checkout',
    stages: [
      {
        index: 0,
        number: '01',
        name: 'Event detected',
        short: 'P0 Linear Alert',
        badge: 'P0 UNASSIGNED',
        tool: 'incident.ingest_linear_ticket(ticket="LIN-309", priority="P0")',
        duration: '1.0ms',
        summary: 'A new critical crash alert arrives from production: Cart Promo Service throwing 500 errors on coupon application during high-concurrency peak.',
        thought: 'New unassigned escalation LIN-309 detected. High severity. Microservice: sys-checkout. Searching graph for historical incident context.',
        activeNodes: ['LIN-309', 'sys-checkout'],
        activeEdges: [['LIN-309', 'sys-checkout']],
        evidence: [
          { id: 'LIN-309', label: 'LIN-309 Promo Crash', type: 'Ticket', role: 'Unassigned P0', detail: 'Cart checkout 500 error spike' },
          { id: 'sys-checkout', label: 'Cart Promo Service', type: 'System', role: 'Failing Microservice', detail: 'Redis coupon locks timing out' },
        ],
        rawTelemetry: '{\n  "ticket": "LIN-309",\n  "service": "sys-checkout",\n  "severity": "P0_CRITICAL",\n  "assigned_to": null,\n  "error_rate": "14.2%"\n}',
      },
      {
        index: 1,
        number: '02',
        name: 'Graph traversal',
        short: 'Expertise Search',
        badge: 'GRAPH RESOLUTION SEARCH',
        tool: 'falkordb.search_historical_resolvers(service="sys-checkout")',
        duration: '5.2ms',
        summary: 'Instead of guessing from job titles, GraphRCA traverses past resolved tickets on sys-checkout to discover who actually solved similar race conditions.',
        thought: 'Traversing (sys-checkout)<-[:MODIFIES]-(t:Ticket)<-[:RESOLVED]-(eng:Person). Discovered previous tickets LIN-202 and LIN-205.',
        activeNodes: ['sys-checkout', 'LIN-202', 'LIN-205', 'user-rohan'],
        activeEdges: [['LIN-202', 'sys-checkout'], ['LIN-205', 'sys-checkout'], ['user-rohan', 'LIN-202'], ['user-rohan', 'LIN-205']],
        evidence: [
          { id: 'LIN-202', label: 'LIN-202 Promo Cart Race', type: 'Ticket', role: 'Past Resolution', detail: 'Solved by Rohan Verma (Done)' },
          { id: 'user-rohan', label: 'Rohan Verma · Backend', type: 'Person', role: 'Historical Resolver', detail: '2 verified fixes on this exact codebase' },
        ],
        rawTelemetry: 'MATCH (new:Ticket {id:"LIN-309"})-[:MODIFIES]->(s:System {id:"sys-checkout"})\nMATCH (s)<-[:MODIFIES]-(past:Ticket {status:"DONE"})<-[:RESOLVED]-(eng:Person)\nRETURN eng.label, count(past) AS fixes, collect(past.id) AS past_tickets\n// Top match: Rohan Verma (2 fixes: LIN-202, LIN-205)',
      },
      {
        index: 2,
        number: '03',
        name: 'Permission validation',
        short: 'On-Call & Authority',
        badge: 'AUTH CHECK',
        tool: 'auth.verify_service_ownership(engineer="user-rohan", repo="cart-promo-srv")',
        duration: '1.2ms',
        summary: 'The agent checks repository permissions and on-call status: Rohan has verified merge rights and contributor status for Cart Promo Microservice.',
        thought: 'Verifying GitHub repository team membership. Rohan Verma possesses merge access and active service tier ownership.',
        activeNodes: ['user-rohan', 'team-prod', 'sys-checkout'],
        activeEdges: [['user-rohan', 'team-prod'], ['team-prod', 'sys-checkout']],
        evidence: [
          { id: 'user-rohan', label: 'Rohan Verma', type: 'Person', role: 'Verified Contributor', detail: 'Full production deploy permissions' },
          { id: 'team-prod', label: 'Product Tech Team', type: 'Team', role: 'Owning Organization', detail: 'Service Tier 1 owner' },
        ],
        rawTelemetry: '{\n  "engineer": "user-rohan",\n  "repo_access": "ADMIN_WRITE",\n  "on_call": true,\n  "assignment_eligible": true\n}',
      },
      {
        index: 3,
        number: '04',
        name: 'Evidence assembled',
        short: 'Code Similarity',
        badge: 'CODEBASE PROVENANCE',
        tool: 'evidence.correlate_stack_trace(current="LIN-309", past="LIN-202")',
        duration: '3.4ms',
        summary: 'Evidence analysis links the current stack trace directly to the Redis coupon reservation mutex fixed in LIN-202, providing immediate diagnostic context.',
        thought: 'Comparing stack traces. Current exception in promo_reservation.py lines 112-140 matches identical concurrency bug resolved in LIN-202.',
        activeNodes: ['LIN-309', 'LIN-202', 'user-rohan'],
        activeEdges: [['LIN-309', 'sys-checkout'], ['LIN-202', 'sys-checkout']],
        evidence: [
          { id: 'LIN-202', label: 'LIN-202 Fix Patch', type: 'Ticket', role: 'Precedent Fix', detail: 'Redis TTL lock implementation' },
          { id: 'user-rohan', label: 'Rohan Verma (98% Match)', type: 'Person', role: 'Subject Matter Expert', detail: 'Original author of mutex module' },
        ],
        rawTelemetry: 'CORRELATION EVIDENCE:\nLIN-309 crash: KeyError: "promo_mutex_ttl"\nLIN-202 fix: PR #441 (Author: Rohan Verma) "Add Redis TTL guard to coupon claim"\nSimilarity Confidence: 98.4%',
      },
      {
        index: 4,
        number: '05',
        name: 'Impact identified',
        short: 'Cart Abandonment',
        badge: 'REVENUE EXPOSURE',
        tool: 'revenue.calculate_checkout_dropoff(error_rate="14.2%")',
        duration: '1.9ms',
        summary: 'The failure causes a 38% checkout abandonment rate across 840 active carts, projecting ₹18,000 GMV loss per minute if misrouted or delayed.',
        thought: 'Calculating conversion degradation. 840 active cart drops in Delhi NCR. Projected revenue attrition: ₹18,000/minute.',
        activeNodes: ['sys-checkout', 'team-prod'],
        activeEdges: [['team-prod', 'sys-checkout']],
        evidence: [
          { id: 'sys-checkout', label: '38% Checkout Drop-off', type: 'System', role: 'Conversion Impact', detail: '840 failed customer carts' },
          { id: 'team-prod', label: '₹18k/min Attrition', type: 'Team', role: 'Financial Burn', detail: 'Peak dinner order window' },
        ],
        rawTelemetry: '{\n  "active_carts_impacted": 840,\n  "abandonment_rate": "38%",\n  "loss_per_minute": "₹18,000",\n  "target_mttr": "< 10 minutes"\n}',
      },
      {
        index: 5,
        number: '06',
        name: 'Action proposed',
        short: 'Auto-Assign With Context',
        badge: 'ONE-CLICK ASSIGN',
        tool: 'linear.assign_ticket_with_context(ticket="LIN-309", assignee="user-rohan")',
        duration: '2.0ms',
        summary: 'The agent auto-assigns LIN-309 to Rohan Verma, attaching LIN-202 resolution notes and pre-populating the exact code diff needed for the hotfix.',
        thought: 'Executing intelligent assignment. Posting Slack notification with deep-linked graph evidence directly to #prod-backend.',
        activeNodes: ['LIN-309', 'user-rohan'],
        activeEdges: [['user-rohan', 'LIN-309']],
        evidence: [
          { id: 'LIN-309', label: 'Assigned: Rohan Verma', type: 'Ticket', role: 'Smart Assignment', detail: 'Bypassed 45-min triage meeting' },
          { id: 'user-rohan', label: 'Attached LIN-202 Context', type: 'Person', role: 'Pre-Populated Fix', detail: 'Saves 35 mins MTTR' },
        ],
        rawTelemetry: 'POST /api/linear/tickets/LIN-309/assignee\n{\n  "assignee": "rohan.verma",\n  "suggested_solution": "Inspect Redis mutex in promo_reservation.py (Ref: LIN-202)",\n  "evidence_confidence": "98%"\n}',
      },
      {
        index: 6,
        number: '07',
        name: 'Outcome verified',
        short: 'MTTR Minimized',
        badge: 'PRECISION DELEGATION',
        tool: 'audit.seal_delegation_record(ticket="LIN-309", latency="10.8ms")',
        duration: '10.8ms',
        summary: 'Incident routed accurately in 10.8ms. Rohan acknowledges the ticket within 90 seconds and commits the fix using the graph-provided LIN-202 reference.',
        thought: 'Delegation verified in graph. Audit entry committed. MTTR reduced from industry average 55 mins to 8 mins.',
        activeNodes: ['LIN-309', 'user-rohan', 'sys-checkout', 'LIN-202'],
        activeEdges: [['user-rohan', 'LIN-309'], ['LIN-202', 'sys-checkout'], ['LIN-309', 'sys-checkout']],
        evidence: [
          { id: 'user-rohan', label: 'Fix Deployed in 8 Mins', type: 'Person', role: 'MTTR Slashed', detail: 'Zero escalations needed' },
          { id: 'LIN-309', label: 'Verifiable Decision Proof', type: 'Ticket', role: 'Graph Record', detail: 'FalkorDB ID: 0x8821...bb41' },
        ],
        rawTelemetry: 'DELEGATION AUDIT RECORD:\nIncident: LIN-309\nAssignee: Rohan Verma (Match: 98% based on LIN-202, LIN-205)\nMTTR Saved: 35 Minutes\nFalkorDB Audit Proof: 0x8821bb41\nResult: 100% Deterministic Attribution',
      },
    ],
  },
};

// -------------------------------------------------------------
// MAIN WORKFLOW SHOWCASE COMPONENT
// -------------------------------------------------------------
export default function AgentWorkflowShowcase({ onLaunchDemo }) {
  const [selectedScenarioKey, setSelectedScenarioKey] = useState('coldchain');
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 1.5x, 2x
  const [expandedTrace, setExpandedTrace] = useState(false);
  const [hoveredEvidenceId, setHoveredEvidenceId] = useState(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 560, height: 460 });

  const scenario = WORKFLOW_SCENARIOS[selectedScenarioKey] || WORKFLOW_SCENARIOS.coldchain;
  const currentStage = scenario.stages[currentStageIndex] || scenario.stages[0];

  const fgRef = useRef(null);
  const graphContainerRef = useRef(null);
  const autoPlayTimerRef = useRef(null);
  const prefersReducedMotionRef = useRef(false);

  // Check reduced-motion preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = mq.matches;
    if (mq.matches) {
      setIsPlaying(false);
    }
  }, []);

  // Update canvas size on window resize
  useEffect(() => {
    function updateDims() {
      if (graphContainerRef.current) {
        const w = graphContainerRef.current.clientWidth;
        const h = Math.max(380, Math.min(520, Math.round(w * 0.78)));
        setGraphDimensions({ width: w, height: h });
      }
    }
    updateDims();
    window.addEventListener('resize', updateDims);
    return () => window.removeEventListener('resize', updateDims);
  }, []);

  // Set up force physics in the graph
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force?.('charge')?.strength?.(-140)?.distanceMax?.(380);
    fg.d3Force?.('link')?.distance?.(70)?.strength?.(0.38);
    fg.d3ReheatSimulation?.();
  }, [selectedScenarioKey]);

  // Center camera on active nodes when stage changes
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || prefersReducedMotionRef.current) return;

    const activeIds = currentStage.activeNodes;
    if (activeIds.length > 0) {
      // Find average position of active nodes
      const activeObjs = mockNodes.filter((n) => activeIds.includes(n.id));
      if (activeObjs.length > 0) {
        const avgX = activeObjs.reduce((sum, n) => sum + (n.x || 0), 0) / activeObjs.length;
        const avgY = activeObjs.reduce((sum, n) => sum + (n.y || 0), 0) / activeObjs.length;
        fg.centerAt?.(avgX, avgY, 600);
      }
    }
    fg.d3ReheatSimulation?.();
  }, [currentStageIndex, currentStage.activeNodes]);

  // Auto-play timer loop: advances stage every ~2.0s (scaled by playbackSpeed)
  useEffect(() => {
    if (!isPlaying || prefersReducedMotionRef.current) {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      return;
    }

    const intervalMs = Math.round(2200 / playbackSpeed);
    autoPlayTimerRef.current = setInterval(() => {
      setCurrentStageIndex((prev) => {
        if (prev >= scenario.stages.length - 1) {
          // Loop back to start after a brief pause
          return 0;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [isPlaying, playbackSpeed, scenario.stages.length]);

  // Reset stage when switching scenarios
  const handleSelectScenario = (key) => {
    setSelectedScenarioKey(key);
    setCurrentStageIndex(0);
    setIsPlaying(true);
    setExpandedTrace(false);
  };

  const handleStepPrev = () => {
    setIsPlaying(false);
    setCurrentStageIndex((prev) => Math.max(0, prev - 1));
  };

  const handleStepNext = () => {
    setIsPlaying(false);
    setCurrentStageIndex((prev) => Math.min(scenario.stages.length - 1, prev + 1));
  };

  const handleReplay = () => {
    setCurrentStageIndex(0);
    setIsPlaying(true);
  };

  const toggleSpeed = () => {
    setPlaybackSpeed((current) => (current === 1 ? 1.5 : current === 1.5 ? 2 : 1));
  };

  // Node & Edge sets for canvas highlighting
  const activeNodeSet = useMemo(() => new Set(currentStage.activeNodes), [currentStage.activeNodes]);
  const activeEdgePairs = useMemo(() => {
    const pairs = new Set();
    currentStage.activeEdges.forEach(([s, t]) => pairs.add(pairKey(s, t)));
    return pairs;
  }, [currentStage.activeEdges]);

  // Canvas paint logic
  const paintNode = useCallback((node, ctx, globalScale) => {
    const isActive = activeNodeSet.has(node.id);
    const isHovered = hoveredEvidenceId === node.id;
    const isStale = node.status === 'STALE' || (selectedScenarioKey === 'surge' && (node.id === 'doc-01' || node.id === 'doc-03'));
    const theme = getNodeTheme(node, isStale);

    let r = node.type === 'Team' ? 8.5 : node.type === 'System' ? 7.8 : 6.8;
    if (isActive) r *= 1.25;
    if (isHovered) r *= 1.35;

    ctx.save();
    // Dim inactive nodes
    ctx.globalAlpha = isActive || isHovered ? 1.0 : 0.22;

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

      // Sharp accent outer ring
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 2.8, 0, Math.PI * 2);
      ctx.strokeStyle = isHovered ? '#ffffff' : theme.light;
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
    specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.beginPath();
    ctx.arc(lightX, lightY, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = specGrad;
    ctx.fill();

    // Labels for active / hovered nodes
    if (isActive || isHovered || globalScale > 1.2) {
      const fontSize = Math.max(9, Math.min(13, 10.5 / globalScale));
      ctx.font = `${isActive || isHovered ? '600' : '400'} ${fontSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const label = node.label || node.id;
      const textY = node.y + r + 4.5;
      const textW = ctx.measureText(label).width;

      ctx.fillStyle = 'rgba(8, 10, 13, 0.85)';
      ctx.fillRect(node.x - textW / 2 - 4, textY - 1, textW + 8, fontSize + 3);

      ctx.fillStyle = isActive || isHovered ? '#ffffff' : 'rgba(226, 232, 240, 0.85)';
      ctx.fillText(label, node.x, textY);
    }

    ctx.restore();
  }, [activeNodeSet, hoveredEvidenceId, selectedScenarioKey]);

  // Link styling
  const getLinkColor = useCallback((link) => {
    const s = getNodeId(link.source);
    const t = getNodeId(link.target);
    const isEdgeActive = activeEdgePairs.has(pairKey(s, t));
    if (isEdgeActive) return '#38bdf8';
    return 'rgba(255, 255, 255, 0.08)';
  }, [activeEdgePairs]);

  const getLinkWidth = useCallback((link) => {
    const s = getNodeId(link.source);
    const t = getNodeId(link.target);
    return activeEdgePairs.has(pairKey(s, t)) ? 2.6 : 1.0;
  }, [activeEdgePairs]);

  const getLinkParticles = useCallback((link) => {
    const s = getNodeId(link.source);
    const t = getNodeId(link.target);
    return activeEdgePairs.has(pairKey(s, t)) ? 4 : 0;
  }, [activeEdgePairs]);

  const graphData = useMemo(() => ({
    nodes: mockNodes.map((n) => ({ ...n })),
    links: mockLinks.map(([source, target, label]) => ({ source, target, label })),
  }), []);

  return (
    <section className="agent-workflow-section" id="agent-workflow">
      <div className="landing-container">
        {/* Section Header (Antimetal style) */}
        <div className="section-eyebrow">
          <span className="num">03</span>
          <span>AGENT EXECUTION ARCHITECTURE</span>
        </div>
        <h2 className="section-title">Watch an operational incident resolve in real time.</h2>
        <p className="section-subtitle">
          How GraphRCA’s autonomous agents ingest an anomaly, traverse the company graph,
          enforce RBAC boundaries, and prove the decision—all in milliseconds.
        </p>

        {/* Workflow Showcase Shell (Beautiful UI style) */}
        <div className="workflow-showcase-shell">
          {/* Top Control Bar: Scenario Selectors + Playback Controls */}
          <div className="workflow-top-bar">
            {/* Scenario Selector Pills */}
            <div className="workflow-scenario-tabs" role="tablist" aria-label="Workflow Scenarios">
              {Object.values(WORKFLOW_SCENARIOS).map((sc) => {
                const isSelected = sc.id === selectedScenarioKey;
                return (
                  <button
                    key={sc.id}
                    role="tab"
                    aria-selected={isSelected}
                    className={`workflow-scenario-pill ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectScenario(sc.id)}
                  >
                    <span className="sc-dot" />
                    <span className="sc-name">{sc.badge}</span>
                  </button>
                );
              })}
            </div>

            {/* Playback Controls & Timeline Scrubber */}
            <div className="workflow-playback-controls">
              <button
                className="workflow-control-btn"
                title={isPlaying ? 'Pause workflow' : 'Play workflow'}
                onClick={() => setIsPlaying((p) => !p)}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                className="workflow-control-btn icon-only"
                title="Step backward"
                onClick={handleStepPrev}
                disabled={currentStageIndex === 0}
                aria-label="Previous step"
              >
                ◀
              </button>

              <button
                className="workflow-control-btn icon-only"
                title="Step forward"
                onClick={handleStepNext}
                disabled={currentStageIndex === scenario.stages.length - 1}
                aria-label="Next step"
              >
                ▶
              </button>

              <button
                className="workflow-control-btn icon-only"
                title="Restart workflow"
                onClick={handleReplay}
                aria-label="Restart"
              >
                <RotateCcw size={12} />
              </button>

              <button
                className="workflow-speed-pill"
                title="Change playback speed"
                onClick={toggleSpeed}
              >
                {playbackSpeed}x
              </button>
            </div>
          </div>

          {/* Sequential 7-Stage Horizontal Step Rail (Beautiful UI interaction pattern) */}
          <div className="workflow-steps-rail" role="tablist" aria-label="Workflow Execution Steps">
            {scenario.stages.map((st, idx) => {
              const isPast = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              const isFuture = idx > currentStageIndex;

              return (
                <button
                  key={st.number}
                  role="tab"
                  aria-selected={isCurrent}
                  className={`workflow-rail-item ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''} ${isFuture ? 'future' : ''}`}
                  onClick={() => {
                    setCurrentStageIndex(idx);
                    setIsPlaying(false);
                  }}
                >
                  <div className="rail-item-top">
                    <span className="rail-step-num">
                      {isPast ? <Check size={11} strokeWidth={3} /> : st.number}
                    </span>
                    <span className="rail-step-name">{st.name}</span>
                  </div>
                  <div className="rail-item-bar">
                    <div className="rail-bar-fill" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Main Showcase Split Grid: Left = Agent Execution Stream, Right = Living Knowledge Graph */}
          <div className="workflow-stage-grid">
            {/* LEFT COLUMN: Agent Execution Stream & Dynamic Evidence Inspector */}
            <div className="workflow-agent-stream">
              {/* Agent Identity Header */}
              <div className="agent-identity-card">
                <div className="agent-avatar-ring">
                  <Cpu size={16} />
                  <span className="pulse-ping" />
                </div>
                <div className="agent-info">
                  <div className="agent-name-row">
                    <b>{scenario.agent}</b>
                    <span className="agent-status-pill">
                      <span className="status-live-dot" />
                      STAGE {currentStage.number} OF 07
                    </span>
                  </div>
                  <div className="agent-model-meta">
                    <span>ENGINE: {scenario.model}</span>
                    <span className="sep">·</span>
                    <span className="mono">LATENCY: {currentStage.duration}</span>
                  </div>
                </div>
              </div>

              {/* Active Stage Card (Beautiful UI card style) */}
              <div className="stage-execution-card">
                <div className="stage-card-header">
                  <div className="stage-header-title">
                    <span className="stage-tag">{currentStage.badge}</span>
                    <h3>{currentStage.name}</h3>
                  </div>
                  <div className="stage-latency-pill">
                    <Clock size={11} />
                    <span>{currentStage.duration}</span>
                  </div>
                </div>

                {/* Tool Invocation Chip (Beautiful UI signature pattern) */}
                <div className="tool-invocation-chip">
                  <Terminal size={12} className="tool-icon" />
                  <code className="tool-code">{currentStage.tool}</code>
                </div>

                {/* Agent Thought / Rationale Stream */}
                <div className="agent-thought-box">
                  <div className="thought-label">
                    <Sparkles size={12} />
                    <span>AGENT RATIONALE</span>
                  </div>
                  <p className="thought-text">{currentStage.thought}</p>
                </div>

                {/* Plain-English Summary */}
                <div className="stage-summary-text">
                  {currentStage.summary}
                </div>

                {/* Source-Linked Evidence Grid (Connects directly to Graph entities) */}
                <div className="stage-evidence-section">
                  <div className="evidence-header">
                    <span className="evidence-title">SOURCE-LINKED EVIDENCE</span>
                    <span className="evidence-hint">Hover to spotlight in graph</span>
                  </div>
                  <div className="evidence-chips-grid">
                    {currentStage.evidence.map((ev) => {
                      const isHovered = hoveredEvidenceId === ev.id;
                      return (
                        <div
                          key={ev.id}
                          className={`evidence-chip ${isHovered ? 'hovered' : ''}`}
                          onMouseEnter={() => setHoveredEvidenceId(ev.id)}
                          onMouseLeave={() => setHoveredEvidenceId(null)}
                          title={`Spotlight ${ev.label} in Company Graph`}
                        >
                          <div className="ev-header">
                            <span className="ev-type">{ev.type}</span>
                            <span className="ev-role">{ev.role}</span>
                          </div>
                          <div className="ev-label">{ev.label}</div>
                          <div className="ev-detail">{ev.detail}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Expandable Raw Telemetry / Cypher Drawer */}
                <div className="stage-drawer-wrapper">
                  <button
                    className="stage-drawer-toggle"
                    onClick={() => setExpandedTrace((v) => !v)}
                  >
                    <span>{expandedTrace ? 'Hide Raw Execution Telemetry' : 'View Raw Execution Telemetry & Cypher'}</span>
                    <ChevronDown size={13} className={`drawer-chevron ${expandedTrace ? 'open' : ''}`} />
                  </button>

                  {expandedTrace && (
                    <div className="stage-drawer-content">
                      <pre className="telemetry-code-block">{currentStage.rawTelemetry}</pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Quick Action: Inspect in full operational lab */}
              <div className="workflow-bottom-actions">
                <button
                  className="open-full-lab-btn"
                  onClick={() => onLaunchDemo(scenario.targetLabScenario)}
                  title="Explore this scenario in the operational Explainability Lab"
                >
                  <span>Open Full Investigation in Lab</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: Living Synchronized Obsidian Knowledge Graph */}
            <div className="workflow-graph-column" ref={graphContainerRef}>
              <div className="workflow-graph-card">
                {/* Graph HUD Header */}
                <div className="graph-hud-overlay top">
                  <div className="hud-badge">
                    <span className="hud-dot" />
                    <span>LIVING OBSIDIAN GRAPH</span>
                  </div>
                  <div className="hud-active-count">
                    <span>{currentStage.activeNodes.length} ACTIVE NODES</span>
                    <span className="hud-sep">·</span>
                    <span>{currentStage.activeEdges.length} HOPS</span>
                  </div>
                </div>

                {/* Force Graph Canvas */}
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
                  linkDirectionalParticleColor={() => '#38bdf8'}
                  cooldownTicks={120}
                  enableZoomInteraction={false}
                  enablePanInteraction={false}
                />

                {/* Graph HUD Bottom Overlay: Active Hop Trace */}
                <div className="graph-hud-overlay bottom">
                  <div className="active-path-tracker">
                    <span className="path-label">ACTIVE PROVENANCE SUBGRAPH:</span>
                    <span className="path-tokens">
                      {currentStage.activeNodes.map((id, i) => (
                        <span key={id} className="token-node">
                          <b>{id}</b>
                          {i < currentStage.activeNodes.length - 1 && <span className="arr">→</span>}
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

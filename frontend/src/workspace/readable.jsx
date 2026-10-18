// Human-readable rendering of investigation text, without losing information.
// - Ids in model or server text are shown with their graph name (Masala Chips 52g · SKU-022); the id stays visible.
// - Schema words (promise_time_min, tool names) become plain words; ISO times become "16 Oct 08:30 UTC".
// - Every tool step gets a sentence, and every query a plain description plus a line-by-line gloss of its Cypher.
import React, { createContext, useContext, useEffect, useState } from 'react';

export const Glossary = createContext(new Map()); // node id -> {id, label, name}

const DASHES = /[‐-―−﹘﹣－]/g; // models write ids with look-alike dashes
const ID = /\b[A-Z][A-Z0-9]*(?:[-‐-―−][A-Z0-9]+)+\b/g;
const ISO = /\b(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?Z?\b/g;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NAMED = new Set(['Person', 'SKU', 'Store', 'Equipment', 'Campaign', 'Supplier']); // labels with short names

export const DEPARTMENTS = { store_ops: 'Store Ops', facilities: 'Facilities', growth: 'Growth', supply: 'Supply', orchestrator: 'Orchestrator' };
const WORDS = {
  promise_time_min: 'promise time', pick_time_sec: 'pick time', sla_drop: 'SLA drop', root_cause: 'root cause',
  root_cause_id: 'root cause', amplifier_id: 'amplifier', finding_ids: 'findings', alert_id: 'alert',
  trace_decision: 'the decision trace', find_amplifiers: 'the campaign check', equipment_status: 'the equipment check',
  find_expert: 'the expert lookup', search_artifacts: 'keyword search', read_findings: 'the shared findings',
  recall_memory: 'memory', connect_path: 'the connection check', rank_people: 'the ownership ranking',
  impact_of: 'the supplier impact check', get_alert: 'the alert', submit_answer: 'the answer', dispatch: 'dispatch',
  ...DEPARTMENTS,
};
const WORD_RE = new RegExp(`\\b(${Object.keys(WORDS).join('|')})\\b`, 'g');

export const niceTime = (s) => String(s).replace(ISO, (_, y, mo, d, h, mi) => `${Number(d)} ${MONTHS[Number(mo) - 1]} ${h}:${mi} UTC`);
export const tidy = (s) => niceTime(String(s ?? '')).replace(WORD_RE, (w) => WORDS[w]);

function Entity({ raw, id, node, named }) {
  const title = `${node.label} ${id}${node.name && node.name !== id ? ` · ${node.name}` : ''}`;
  if (named) {
    return <span className="ent" title={title}>{node.name}<span className="ent-id">{id}</span></span>;
  }
  return <span className="ent ent-idonly" title={title}>{id}</span>;
}

// Render text with ids resolved against the graph. If the name is already written next to the id
// ("Front chiller A1 (EQ-SD04-CHA1)"), only the id is styled, so nothing is repeated.
export function Readable({ text }) {
  const glossary = useContext(Glossary);
  if (text === null || text === undefined || text === '') return null;
  const t = tidy(text);
  const out = [];
  let last = 0;
  for (const m of t.matchAll(ID)) {
    const id = m[0].replace(DASHES, '-');
    const node = glossary.get(id);
    if (!node) continue;
    out.push(t.slice(last, m.index));
    const before = t.slice(Math.max(0, m.index - 80), m.index).toLowerCase();
    const short = NAMED.has(node.label) && node.name && !node.name.includes(id) && node.name.length <= 40;
    const named = short && !before.includes(node.name.toLowerCase());
    out.push(<Entity key={m.index} raw={m[0]} id={id} node={node} named={named} />);
    last = m.index + m[0].length;
  }
  out.push(t.slice(last));
  return <>{out}</>;
}

// One sentence per tool step. Strings may contain ids; render them through <Readable>.
export function stepSentence(tool, args = {}) {
  const a = args || {};
  switch (tool) {
    case 'get_alert': return 'Read the alert';
    case 'recall_memory': return 'Checked memory for similar past incidents';
    case 'trace_decision': return 'Traced the store decision behind the alert';
    case 'find_amplifiers': return 'Looked for campaigns pushing demand for the item';
    case 'equipment_status': return `Checked ${a.kind ? `${a.kind}s` : 'equipment'} and open repair tickets at ${a.store_id}`;
    case 'find_expert': return `Found who knows ${a.entity_id} best`;
    case 'search_artifacts': return `Searched messages and tickets for “${a.text}”`;
    case 'read_findings': return a.agent ? `Read ${DEPARTMENTS[a.agent] || a.agent}'s findings` : "Read every department's findings so far";
    case 'connect_path': return `Checked how ${a.from_id} and ${a.to_id} are connected`;
    case 'rank_people': return 'Ranked who should own this incident';
    case 'impact_of': return `Mapped what a late delivery from ${a.supplier_id} would break`;
    case 'submit_answer': return 'Submitted the answer for validation';
    case 'dispatch': return `Sent tasks to ${(a.tasks || []).map((t) => DEPARTMENTS[t?.department] || t?.department).join(' and ')}`;
    default: return tool;
  }
}

// What each query asks the graph, in plain words (the Cypher itself is shown underneath).
export const QUERY_PLAIN = {
  get_alert: 'Read the alert, and the store and item it is attached to.',
  recall_memory: 'Look for past incidents with the same metric on items of the same category, closest first (same store and item, then same item, then same area), together with the investigation plan learned from them.',
  trace_decision: 'Start at the alert, find the item and store it is about, then find the most recent decision that changed how that item is handled in that store before the alert fired. For that decision, collect who made it, the messages that discussed it, and what it was blamed on (equipment or tickets), with who owns or is assigned to each.',
  find_amplifiers: 'Find campaigns that are active, promote the alert’s item, target the alert’s store, and started before the alert, with their owner and launch message.',
  equipment_status: 'List a store’s equipment (optionally of one kind), who owns each unit, and every ticket about it with its status and assignee.',
  find_expert: 'Count how often each person has worked on this thing, directly or through tickets about it, and flag its owner.',
  search_artifacts: 'Keyword search across Slack messages, SOPs, ticket text and item names. Matches are leads, not proof.',
  read_findings: 'Read the findings the departments have written for this investigation so far.',
  connect_path: 'Find the shortest chain of relationships linking two things, following links in either direction.',
  rank_people: 'Find the people who own or worked on the things this investigation found, ranked by how many links they have; PageRank over the whole graph breaks ties.',
  impact_of: 'From a supplier, find the items it supplies, the stores stocking them, and active campaigns on those items in those stores, with owners.',
};

const words = (x) => String(x).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
const nounOf = (label) => (label === 'SKU' ? 'SKU' : /^(Episodic|Procedural)$/.test(label) ? `${words(label)} memory` : words(label));
const article = (n) => (/^[aeiou]/i.test(n) && !/^(SKU|one)/.test(n) ? 'an' : 'a');
const REL = (r) => r.split('|').map(words).join(' or ');

// A plain-English gloss for each line of a Cypher query. Remembers what each variable stands for, so later
// lines read "that store" instead of "(st)". Heuristic: covers the shapes in queries/, stays quiet otherwise.
export function glossQuery(cypher) {
  const vars = {};
  let mode = null;
  const prop = (text) => text.replace(/\b(\w+)\.(\w+)\b/g, (_, v, p) => `${vars[v] ? `the ${vars[v]}'s` : ''} ${words(p)}`.trim());
  const nodes = (text) => text.replace(/\((\w+)?(?::([A-Za-z:]+))?\s*(\{[^}]*\})?\)/g, (_, v, label, props) => {
    const known = v && vars[v];
    if (label) vars[v || '_'] = nounOf(label.split(':').pop());
    else if (v && props && !known) vars[v] = 'node';
    const n = label ? nounOf(label.split(':').pop()) : known || (v ? words(v) : 'any node');
    if (props && /\$(\w+)/.test(props)) {
      const param = props.match(/\$(\w+)/)[1];
      return label ? `the given ${n}` : `the node with the given ${words(param)}`;
    }
    if (props) {
      const lit = props.replace(/[{}]/g, '').split(',').map((kv) => kv.split(':').map((x) => prop(x.trim().replace(/^'|'$/g, ''))));
      return lit.length === 1 && lit[0][0] === 'status' ? `${article(lit[0][1])} ${lit[0][1]} ${n}` : `${article(n)} ${n} with ${lit.map(([k, val]) => `${words(k)} ${val}`).join(', ')}`;
    }
    if (known) return `that ${n}`;
    if (!v && !label) return 'something';
    if (!label && v.length <= 2) return 'something';
    return `${article(n)} ${n}`;
  });
  const rels = (text) => text
    .replace(/-\[(\w+)?:([A-Z_|]+)\]->/g, (_, v, r) => ` → ${REL(r)} → `)
    .replace(/<-\[(\w+)?:([A-Z_|]+)\]-/g, (_, v, r) => ` ← ${REL(r)} ← `)
    .replace(/-\[(\w+)?:([A-Z_|]+)\]-/g, (_, v, r) => ` – ${REL(r)} – `);
  const pattern = (text) => rels(nodes(text)).replace(/\s{2,}/g, ' ').trim();
  const aliases = (text) => [...text.matchAll(/\bAS\s+(\w+)/g)].map((m) => words(m[1]));
  const cond = (text) => prop(text
    .replace(/\$(\w+) IS NULL OR (\w+)\.(\w+) = \$\1/g, (_, x) => `if a ${words(x)} is given, only that ${words(x)}`)
    .replace(/NOT \(\)-\[:SUPERSEDES\]->\((\w+)\)/g, 'it has not been replaced by a newer memory')
    .replace(/(\w+) = (\w+) OR \((\w+):(\w+) AND \(\3\)-\[:(\w+)\]->\((\w+)\)\)/g, (_, a, b, c, lab, r, d) => `it is that thing itself, or a ${nounOf(lab)} ${REL(r)} it`)
    .replace(/\s<=\s/g, ' is on or before ').replace(/\s>=\s/g, ' is on or after ').replace(/\s<>\s/g, ' is not ')
    .replace(/\bIN \$(\w+)/g, (_, x) => `is one of the given ${words(x)}`).replace(/\$(\w+)/g, (_, x) => `the given ${words(x)}`)
    .replace(/\bNOT\b/g, 'not').replace(/\bAND\b/g, 'and').replace(/\bOR\b/g, 'or').replace(/\bIS NULL\b/g, 'is empty')
    .replace(/(\w+):(\w+)/g, (_, v, lab) => `it is ${article(nounOf(lab))} ${nounOf(lab)}`));

  return cypher.split('\n').map((raw) => {
    const l = raw.trim();
    let m;
    if (!l) return '';
    if ((m = l.match(/^OPTIONAL MATCH\s+(.*)$/))) { mode = 'match'; return `If there is one, also find ${pattern(m[1])}`; }
    if ((m = l.match(/^MATCH\s+(.*)$/))) { mode = 'match'; return `Find ${pattern(m[1])}`; }
    if ((m = l.match(/^WHERE\s+(.*)$/))) { mode = 'where'; return `Keep only where ${cond(m[1])}`; }
    if ((m = l.match(/^UNWIND\s+\$(\w+)\s+AS\s+(\w+)/))) { vars[m[2]] = words(m[1]).replace(/s$/, ''); return `For each of the given ${words(m[1])}`; }
    if ((m = l.match(/^CALL db\.idx\.fulltext\.queryNodes\('(\w+)',\s*\$(\w+)\)/))) { vars.node = nounOf(m[1]); return `Full-text search over ${nounOf(m[1])} text for the given ${words(m[2])}, with a relevance score`; }
    if (/^CALL algo\.SPpaths/.test(l)) return 'Run the shortest-path algorithm between them, following links in either direction, up to the given max length';
    if (/^CALL algo\.pageRank/.test(l)) return 'Run PageRank over the whole graph to score how central each node is';
    if (/^YIELD/.test(l)) return '';
    if (/^UNION/.test(l)) return 'Then also search:';
    if ((m = l.match(/^LIMIT\s+(\d+)/))) return `Keep the top ${m[1]}`;
    if ((m = l.match(/^ORDER BY\s+(.*)$/))) return `Sort by ${prop(m[1]).replace(/\bDESC\b/g, '(highest first)').replace(/\bASC\b/g, '(lowest first)')}`;
    if ((m = l.match(/^WITH\b(.*)$/))) {
      mode = 'with';
      if (/ORDER BY ([\w.]+) DESC LIMIT 1/.test(l)) return `Keep only the most recent one (by ${prop(l.match(/ORDER BY ([\w.]+) DESC/)[1])})`;
      const cs = [...l.matchAll(/collect\((?:DISTINCT )?([^)]*)\) AS (\w+)/g)].map((c) => `collect the ${words(c[2])}`);
      const counts = [...l.matchAll(/count\([^)]*\) AS (\w+)/g)].map((c) => `count them as ${words(c[1])}`);
      const w = l.match(/\bWHERE\s+(.*)$/);
      return [...cs, ...counts, w ? `keep only where ${cond(w[1])}` : ''].filter(Boolean).join('; ').replace(/^./, (c) => c.toUpperCase());
    }
    if ((m = l.match(/^RETURN\s+(.*)$/))) { mode = 'return'; const a = aliases(m[1]); return a.length ? `Return ${a.join(', ')}` : 'Return the results'; }
    if ((m = l.match(/^(CREATE|MERGE)\s+(.*)$/))) return `${m[1] === 'MERGE' ? 'Create unless it exists' : 'Create'} ${pattern(m[2])}`;
    if (mode === 'return') { const a = aliases(l); return a.length ? `…and ${a.join(', ')}` : ''; }
    if (mode === 'with' && /CASE WHEN/.test(l)) {
      const parts = [...l.matchAll(/CASE WHEN (\w+)\.(\w+) = (\w+)\.\2 THEN (\d+)/g)].map((c) => `+${c[4]} if the ${c[2] === 'id' ? (vars[c[3]] || 'node') : words(c[2])} matches`);
      const a = aliases(l);
      return `Score: ${parts.join(', ')}${a.length ? ` (as ${a.join(', ')})` : ''}`;
    }
    return '';
  });
}

export const glossCypher = (line) => glossQuery(line)[0];

let queriesCache = null;
export function useQueries() {
  const [q, setQ] = useState(queriesCache);
  useEffect(() => {
    if (queriesCache) return;
    fetch('/api/queries').then((r) => (r.ok ? r.json() : {})).then((d) => { queriesCache = d; setQ(d); }).catch(() => setQ({}));
  }, []);
  return q;
}

// "What it asked the graph": plain description, then the real Cypher with a gloss beside each line.
export function QueryExplainer({ tool }) {
  const queries = useQueries();
  const q = queries?.[tool];
  if (!QUERY_PLAIN[tool] && !q) return <p className="query-plain">This step runs in code, not a graph query.</p>;
  return (
    <div className="query-explainer">
      <p className="query-plain">{QUERY_PLAIN[tool] || q?.about}</p>
      {q ? (
        <div className="query-lines">
          {(() => {
            const glosses = glossQuery(q.cypher);
            return q.cypher.split('\n').map((line, i) => (
              <div key={i} className="query-line">
                <code>{line}</code>
                <span className="query-gloss">{glosses[i]}</span>
              </div>
            ));
          })()}
          <div className="query-file">{q.file}</div>
        </div>
      ) : queries === null ? <p className="query-plain">Loading the query…</p> : null}
    </div>
  );
}

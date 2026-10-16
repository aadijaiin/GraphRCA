// recall_memory: past incidents like this alert. Episodic memories from investigations of alerts with the same
// metric whose SKU has the same category, ranked same store+SKU > same SKU > same zone > same category, newest first.
// Superseded memories are skipped. Returns the matching procedural plan for the same pattern, if any.
MATCH (a:Alert {id: $alert_id})-[:INVOLVES]->(s:SKU), (a)-[:AT]->(st:Store)
MATCH (m:Memory:Episodic {metric: a.metric, sku_category: s.category})
WHERE m.alert_id <> a.id AND NOT ()-[:SUPERSEDES]->(m)
OPTIONAL MATCH (m)-[:ABOUT_ENTITY]->(mst:Store)
OPTIONAL MATCH (m)-[:ABOUT_ENTITY]->(ms:SKU)
OPTIONAL MATCH (m)-[:ABOUT_ENTITY]->(root) WHERE root.id = m.root_cause_id
OPTIONAL MATCH (p:Memory:Procedural {key: m.metric + '|' + m.sku_category + '|' + m.root_cause_kind})
WHERE NOT ()-[:SUPERSEDES]->(p)
WITH m, p, root,
     (CASE WHEN mst.id = st.id THEN 4 ELSE 0 END) + (CASE WHEN ms.id = s.id THEN 2 ELSE 0 END) +
     (CASE WHEN mst.zone = st.zone THEN 1 ELSE 0 END) AS similarity
RETURN m.id AS memory_id, m.content AS content, m.alert_id AS past_alert_id, m.root_cause_kind AS root_cause_kind,
       m.root_cause_id AS root_cause_id, labels(root)[0] AS root_cause_label, similarity,
       p.id AS procedural_id, p.content AS procedural_content, p.plan AS plan, p.times_confirmed AS times_confirmed
ORDER BY similarity DESC, m.created_at DESC
LIMIT 3

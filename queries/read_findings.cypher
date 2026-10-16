// read_findings: the shared state. Every Finding written so far for an investigation, oldest first,
// optionally only one department's. Agents read each other's work through this query.
MATCH (i:Investigation {id: $investigation_id})<-[:PART_OF]-(f:Finding)
WHERE $agent IS NULL OR f.agent = $agent
OPTIONAL MATCH (f)-[:CITES]->(n)
RETURN f.id AS finding_id, f.agent AS agent, f.tool AS tool, f.task_id AS task_id, f.summary AS summary,
       f.data AS data, f.ts AS ts, collect(n.id) AS cites
ORDER BY f.ts, f.id

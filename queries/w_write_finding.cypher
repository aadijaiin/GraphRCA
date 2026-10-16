// w_write_finding: one verified fact from one tool call, citing the real nodes the tool touched.
// Cited ids that do not exist are simply not linked (the OPTIONAL MATCH finds nothing).
MATCH (i:Investigation {id: $investigation_id})
CREATE (f:Finding {id: $id, agent: $agent, tool: $tool, task_id: $task_id, summary: $summary, data: $data, ts: $ts})
CREATE (f)-[:PART_OF]->(i)
WITH f
UNWIND $cites AS cid
MATCH (n {id: cid})
CREATE (f)-[:CITES]->(n)
RETURN count(*) AS cited

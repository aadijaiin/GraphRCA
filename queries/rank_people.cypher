// rank_people (Track 01): who should own this incident. People who OWN or WORKED_ON the entities this
// investigation's Findings cite, ranked by that incident-local degree, with whole-graph PageRank as tie-break.
CALL algo.pageRank(null, null) YIELD node, score
WITH node, score WHERE node:Person
WITH collect({id: node.id, score: score}) AS pr
MATCH (i:Investigation {id: $investigation_id})<-[:PART_OF]-(f:Finding)-[:CITES]->(n)
WHERE NOT n:Artifact AND NOT n:Person
WITH pr, collect(DISTINCT n) AS entities
UNWIND entities AS n
MATCH (p:Person)-[r:OWNS|WORKED_ON]->(n)
WITH pr, p, count(r) AS links, collect(DISTINCT n.id) AS via
RETURN p.id AS person_id, p.name AS name, p.role AS role, links, via,
       [x IN pr WHERE x.id = p.id][0].score AS pagerank
ORDER BY links DESC, pagerank DESC
LIMIT 5

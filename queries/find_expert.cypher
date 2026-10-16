// find_expert: who has touched this entity the most, counting direct WORKED_ON edges and
// WORKED_ON edges to tickets ABOUT the entity; flags the entity's owner.
// The entity can be any label, so the first MATCH is unlabeled (a scan; fine at this graph size).
// Note: FalkorDB rejected the collect()+collect() list-concat form of this query, hence WHERE ... OR.
MATCH (x {id: $entity_id})
MATCH (p:Person)-[:WORKED_ON]->(y)
WHERE y = x OR (y:Ticket AND (y)-[:ABOUT]->(x))
WITH x, p, count(*) AS touches, collect(CASE WHEN y = x THEN null ELSE y.id END) AS via_tickets
OPTIONAL MATCH (p)-[o:OWNS]->(x)
RETURN p.id AS person_id, p.name AS name, p.role AS role, p.team AS team, touches, via_tickets,
       o IS NOT NULL AS is_owner, x.id AS entity_id
ORDER BY touches DESC, name ASC
LIMIT 5

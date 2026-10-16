// equipment_status (Facilities): cold/rack/scanner units at a store, optionally one kind, with each unit's owner
// and its tickets (status, assignee). Used to check whether a fault is known, open and assigned.
MATCH (st:Store {id: $store_id})-[:HAS_EQUIPMENT]->(e:Equipment)
WHERE $kind IS NULL OR e.kind = $kind
OPTIONAL MATCH (owner:Person)-[:OWNS]->(e)
OPTIONAL MATCH (t:Ticket)-[:ABOUT]->(e)
OPTIONAL MATCH (assignee:Person)-[:OWNS]->(t)
OPTIONAL MATCH (ev:Artifact)-[:EVIDENCE_FOR]->(t)
RETURN e.id AS equipment_id, e.name AS equipment_name, e.kind AS kind, e.location AS location, st.id AS store_id,
       owner.id AS owner_id, owner.name AS owner_name, owner.role AS owner_role,
       t.id AS ticket_id, t.title AS ticket_title, t.status AS ticket_status, t.created_at AS ticket_created_at,
       assignee.id AS assignee_id, assignee.name AS assignee_name, collect(DISTINCT ev.id) AS evidence
ORDER BY equipment_id, ticket_created_at DESC

// ticket_subject: the equipment a ticket is about. The validator uses it when a model names a ticket as the root
// cause: the root cause is the thing that failed, the ticket is the record of it.
MATCH (t:Ticket {id: $id})-[:ABOUT]->(e:Equipment)
RETURN e.id AS equipment_id

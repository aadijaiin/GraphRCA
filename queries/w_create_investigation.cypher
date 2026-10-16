// w_create_investigation: open the shared state for one case, linked to the alert that triggered it.
MATCH (a:Alert {id: $alert_id})
CREATE (i:Investigation {id: $id, alert_id: $alert_id, status: 'running', model: $model, started_at: $ts})
CREATE (i)-[:TRIGGERED_BY]->(a)
RETURN i.id

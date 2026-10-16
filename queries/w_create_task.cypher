// w_create_task: the orchestrator's instruction to one department, part of the investigation.
MATCH (i:Investigation {id: $investigation_id})
CREATE (t:Task {id: $id, department: $department, instruction: $instruction, round: $round, status: 'open'})
CREATE (t)-[:PART_OF]->(i)
RETURN t.id

// finding_sources: the source Artifacts each Finding cites. The validator attaches these to claims, so a claim's
// sources come from the graph, never from the model.
MATCH (i:Investigation {id: $investigation_id})<-[:PART_OF]-(f:Finding)-[:CITES]->(a:Artifact)
WHERE f.id IN $finding_ids
RETURN f.id AS finding_id, collect(a.id) AS sources

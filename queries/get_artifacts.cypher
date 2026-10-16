// get_artifacts: source text, author and time for a list of Artifact ids (provenance panel and citations).
UNWIND $ids AS aid
MATCH (ar:Artifact {id: aid})
OPTIONAL MATCH (ar)-[:AUTHORED_BY]->(p:Person)
RETURN ar.id AS id, ar.kind AS kind, ar.text AS text, ar.ts AS ts, ar.source_ref AS source_ref,
       p.id AS author_id, p.name AS author_name

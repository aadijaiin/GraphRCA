// check_ids: which of these ids exist, and with which label. The Ingestor rejects events that reference unknown ids.
UNWIND $ids AS nid
OPTIONAL MATCH (n {id: nid})
RETURN nid AS id, labels(n)[0] AS label

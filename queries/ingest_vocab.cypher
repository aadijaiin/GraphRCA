// ingest_vocab: names the Ingestor matches in free text (SKUs and campaigns by name).
MATCH (n) WHERE n:SKU OR n:Campaign
RETURN n.id AS id, labels(n)[0] AS label, n.name AS name

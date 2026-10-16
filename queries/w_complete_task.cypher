// w_complete_task: a department reports back.
MATCH (t:Task {id: $id})
SET t.status = 'done', t.report = $report
RETURN t.id

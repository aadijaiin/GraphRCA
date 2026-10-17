// w_complete_task: a department reports back (status 'done', or 'failed' if its agent errored).
MATCH (t:Task {id: $id})
SET t.status = $status, t.report = $report
RETURN t.id

// w_finish_investigation: store the validated answer on the investigation (persistent history).
MATCH (i:Investigation {id: $id})
SET i.status = $status, i.finished_at = $ts, i.answer = $answer
RETURN i.id

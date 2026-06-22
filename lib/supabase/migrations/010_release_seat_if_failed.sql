-- Release a pending seat (used for rollback if enrollment creation fails)
CREATE OR REPLACE FUNCTION release_pending_seat(
  p_academic_year_id uuid,
  p_branch_id uuid,
  p_grade_id uuid,
  p_stream_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE grade_capacities
  SET pending_seats = GREATEST(0, pending_seats - 1),
      updated_at = now()
  WHERE academic_year_id = p_academic_year_id
    AND branch_id = p_branch_id
    AND grade_id = p_grade_id
    AND (
      (p_stream_id IS NULL AND stream_id IS NULL) OR
      stream_id = p_stream_id
    );
END;
$$;
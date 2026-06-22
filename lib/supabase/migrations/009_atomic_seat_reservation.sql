-- Atomic seat reservation function
-- Returns 'reserved' if seat taken, 'waitlisted' if waitlist open,
-- 'blocked' if both full
CREATE OR REPLACE FUNCTION attempt_seat_reservation(
  p_academic_year_id uuid,
  p_branch_id uuid,
  p_grade_id uuid,
  p_stream_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result text;
  v_rows_updated integer;
BEGIN
  -- Attempt to increment pending_seats atomically
  UPDATE grade_capacities
  SET pending_seats = pending_seats + 1,
      updated_at = now()
  WHERE academic_year_id = p_academic_year_id
    AND branch_id = p_branch_id
    AND grade_id = p_grade_id
    AND (
      (p_stream_id IS NULL AND stream_id IS NULL) OR
      stream_id = p_stream_id
    )
    AND (total_seats - pending_seats - reserved_seats - enrolled_seats) > 0;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated > 0 THEN
    RETURN 'reserved';
  END IF;

  -- No seat available — check waitlist
  UPDATE grade_capacities
  SET waitlist_count = waitlist_count + 1,
      updated_at = now()
  WHERE academic_year_id = p_academic_year_id
    AND branch_id = p_branch_id
    AND grade_id = p_grade_id
    AND (
      (p_stream_id IS NULL AND stream_id IS NULL) OR
      stream_id = p_stream_id
    )
    AND waitlist_count < waitlist_capacity;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated > 0 THEN
    RETURN 'waitlisted';
  END IF;

  RETURN 'blocked';
END;
$$;
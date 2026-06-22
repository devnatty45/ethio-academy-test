-- Fuzzy student matching function
-- Uses pg_trgm for name similarity + exact DOB match
-- Returns matches with similarity scores

CREATE OR REPLACE FUNCTION search_students_fuzzy(
  p_name_normalized text,
  p_dob_normalized text,
  p_similarity_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  stu_id text,
  full_name text,
  full_name_normalized text,
  date_of_birth date,
  gender text,
  status text,
  name_similarity float,
  dob_matches boolean,
  overall_score float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.stu_id,
    s.full_name,
    s.full_name_normalized,
    s.date_of_birth,
    s.gender,
    s.status,
    similarity(s.full_name_normalized, p_name_normalized)::float AS name_similarity,
    (s.dob_normalized = p_dob_normalized) AS dob_matches,
    -- Overall score: name similarity weighted 60%, DOB match weighted 40%
    (
      similarity(s.full_name_normalized, p_name_normalized) * 0.6 +
      CASE WHEN s.dob_normalized = p_dob_normalized THEN 0.4 ELSE 0.0 END
    )::float AS overall_score
  FROM students s
  WHERE
    s.status = 'ACTIVE'
    AND similarity(s.full_name_normalized, p_name_normalized) >= p_similarity_threshold
  ORDER BY overall_score DESC, name_similarity DESC
  LIMIT 10;
END;
$$;
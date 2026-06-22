CREATE TABLE enrollment_review_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id),
  locked_by_admin_id uuid NOT NULL REFERENCES users(id),
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (enrollment_id)
);

ALTER TABLE enrollment_review_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locks_admin_access" ON enrollment_review_locks
  FOR ALL USING (
    get_my_role() IN ('BRANCH_ADMIN', 'MASTER_ADMIN')
  );
CREATE TABLE co_guardian_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id),
  invited_phone text NOT NULL,
  invite_token text NOT NULL UNIQUE,
  invite_token_expires_at timestamptz NOT NULL,
  invited_by_guardian_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
  accepted_by_guardian_id uuid REFERENCES users(id),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE co_guardian_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "co_guardian_invites_guardian_own" ON co_guardian_invites
  FOR SELECT USING (
    invited_by_guardian_id = auth.uid() OR
    accepted_by_guardian_id = auth.uid()
  );

CREATE POLICY "co_guardian_invites_master_admin" ON co_guardian_invites
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');
-- Script 1: Extensions and STU ID sequence
-- Run this first — everything else depends on it

-- Enable pgcrypto for FAN/FIN encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enable pg_trgm for fuzzy name matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- STU ID sequence — ONLY way to generate student IDs
-- Never use MAX(id)+1 or any other method
CREATE SEQUENCE IF NOT EXISTS stu_id_sequence
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  NO CYCLE;


  -- Script 2: Core user and admin tables

CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text,
  role text NOT NULL CHECK (role IN ('GUARDIAN', 'BRANCH_ADMIN', 'MASTER_ADMIN')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEACTIVATED')),
  recovery_transferred_to uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE TABLE guardian_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  fan_fin_encrypted text NOT NULL,
  national_id_front_public_id text NOT NULL,
  national_id_back_public_id text NOT NULL,
  residential_address text NOT NULL,
  is_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE guardian_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE admin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  assigned_branch_id uuid, -- FK added after branches table created
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE admin_mfa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  totp_secret_encrypted text NOT NULL,
  backup_codes_hashed jsonb NOT NULL DEFAULT '[]',
  is_configured boolean NOT NULL DEFAULT false,
  configured_at timestamptz,
  last_verified_at timestamptz,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_mfa ENABLE ROW LEVEL SECURITY;

-- Script 3: School structure tables

CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Insert the three branches immediately
INSERT INTO branches (name, code) VALUES
  ('Keta', 'KETA'),
  ('Asko', 'ASKO'),
  ('Chereta', 'CHERETA');

CREATE TABLE grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  level_order integer NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- Insert all grades in order
INSERT INTO grades (name, level_order) VALUES
  ('Nursery', 1),
  ('KG1', 2),
  ('KG2', 3),
  ('Grade 1', 4),
  ('Grade 2', 5),
  ('Grade 3', 6),
  ('Grade 4', 7),
  ('Grade 5', 8),
  ('Grade 6', 9),
  ('Grade 7', 10),
  ('Grade 8', 11),
  ('Grade 9', 12),
  ('Grade 10', 13),
  ('Grade 11', 14),
  ('Grade 12', 15);

CREATE TABLE streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;

-- Insert the two streams
INSERT INTO streams (name) VALUES
  ('Natural'),
  ('Social');

-- Now add the FK from admin_profiles to branches
ALTER TABLE admin_profiles
  ADD CONSTRAINT admin_profiles_assigned_branch_id_fkey
  FOREIGN KEY (assigned_branch_id) REFERENCES branches(id);

CREATE TABLE branch_grade_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id),
  grade_id uuid NOT NULL REFERENCES grades(id),
  academic_year_id uuid NOT NULL, -- FK added after academic_years created
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, grade_id, academic_year_id)
);
ALTER TABLE branch_grade_configs ENABLE ROW LEVEL SECURITY;

CREATE TABLE branch_grade_stream_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id),
  grade_id uuid NOT NULL REFERENCES grades(id),
  stream_id uuid NOT NULL REFERENCES streams(id),
  academic_year_id uuid NOT NULL, -- FK added after academic_years created
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, grade_id, stream_id, academic_year_id)
);
ALTER TABLE branch_grade_stream_configs ENABLE ROW LEVEL SECURITY;

CREATE TABLE grade_progression_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_grade_id uuid NOT NULL REFERENCES grades(id),
  from_branch_id uuid NOT NULL REFERENCES branches(id),
  to_grade_id uuid NOT NULL REFERENCES grades(id),
  to_branch_id uuid NOT NULL REFERENCES branches(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_grade_id, from_branch_id)
);
ALTER TABLE grade_progression_rules ENABLE ROW LEVEL SECURITY;

-- Script 4: Academic year and capacity tables

CREATE TABLE academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  start_year integer NOT NULL,
  end_year integer NOT NULL,
  status text NOT NULL DEFAULT 'CONFIGURATION'
    CHECK (status IN ('CONFIGURATION', 'OPEN', 'CLOSED', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_year_range CHECK (end_year = start_year + 1)
);
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;

-- Now add the deferred FKs to branch_grade_configs and branch_grade_stream_configs
ALTER TABLE branch_grade_configs
  ADD CONSTRAINT branch_grade_configs_academic_year_id_fkey
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id);

ALTER TABLE branch_grade_stream_configs
  ADD CONSTRAINT branch_grade_stream_configs_academic_year_id_fkey
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id);

CREATE TABLE grade_capacities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL REFERENCES academic_years(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  grade_id uuid NOT NULL REFERENCES grades(id),
  stream_id uuid REFERENCES streams(id),
  total_seats integer NOT NULL CHECK (total_seats > 0),
  pending_seats integer NOT NULL DEFAULT 0 CHECK (pending_seats >= 0),
  reserved_seats integer NOT NULL DEFAULT 0 CHECK (reserved_seats >= 0),
  enrolled_seats integer NOT NULL DEFAULT 0 CHECK (enrolled_seats >= 0),
  waitlist_capacity integer NOT NULL DEFAULT 0 CHECK (waitlist_capacity >= 0),
  waitlist_count integer NOT NULL DEFAULT 0 CHECK (waitlist_count >= 0),
  waitlist_window_hours integer NOT NULL DEFAULT 72,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, branch_id, grade_id, stream_id),
  CONSTRAINT seats_never_exceed_total CHECK (
    pending_seats + reserved_seats + enrolled_seats <= total_seats
  )
);
ALTER TABLE grade_capacities ENABLE ROW LEVEL SECURITY;

-- Script 5: Student and guardian-student linking tables

CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stu_id text NOT NULL UNIQUE
    DEFAULT 'STU' || LPAD(nextval('stu_id_sequence')::text, 4, '0'),
  full_name text NOT NULL,
  full_name_normalized text NOT NULL,
  date_of_birth date NOT NULL,
  dob_normalized text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('MALE', 'FEMALE')),
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'MERGED', 'DEACTIVATED')),
  merged_into_student_id uuid REFERENCES students(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Index for fuzzy matching performance
CREATE INDEX students_full_name_normalized_trgm_idx
  ON students USING gin (full_name_normalized gin_trgm_ops);

CREATE INDEX students_dob_normalized_idx
  ON students (dob_normalized);

CREATE TABLE guardian_student_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id uuid NOT NULL REFERENCES users(id),
  student_id uuid NOT NULL REFERENCES students(id),
  link_type text NOT NULL CHECK (link_type IN ('PRIMARY', 'CO_GUARDIAN')),
  is_active boolean NOT NULL DEFAULT true,
  invite_token text UNIQUE,
  invite_token_expires_at timestamptz,
  invited_by_guardian_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guardian_id, student_id)
);
ALTER TABLE guardian_student_links ENABLE ROW LEVEL SECURITY;

CREATE TABLE claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claimed_guardian_id uuid NOT NULL REFERENCES users(id),
  matched_student_id uuid NOT NULL REFERENCES students(id),
  confidence_score numeric(5,2) NOT NULL,
  submitted_details jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by uuid REFERENCES users(id),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE claim_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE guardian_recovery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  new_guardian_id uuid NOT NULL REFERENCES users(id),
  claimed_full_name text NOT NULL,
  claimed_phone text NOT NULL,
  claimed_fan_fin_encrypted text NOT NULL,
  national_id_front_public_id text NOT NULL,
  national_id_back_public_id text NOT NULL,
  claimed_student_name text NOT NULL,
  claimed_student_dob date NOT NULL,
  recovery_reason text NOT NULL,
  confidence_level text NOT NULL
    CHECK (confidence_level IN ('HIGH', 'MEDIUM', 'LOW')),
  matched_guardian_id uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PHYSICAL_VISIT_REQUIRED')),
  reviewed_by uuid REFERENCES users(id),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE guardian_recovery_requests ENABLE ROW LEVEL SECURITY;

-- Script 6: Enrollment tables

CREATE TABLE fee_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL REFERENCES academic_years(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  grade_id uuid NOT NULL REFERENCES grades(id),
  stream_id uuid REFERENCES streams(id),
  registration_fee numeric(10,2) NOT NULL CHECK (registration_fee >= 0),
  first_month_fee numeric(10,2) NOT NULL CHECK (first_month_fee >= 0),
  total_amount numeric(10,2) NOT NULL CHECK (total_amount > 0),
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;

CREATE TABLE enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id),
  guardian_id uuid NOT NULL REFERENCES users(id),
  academic_year_id uuid NOT NULL REFERENCES academic_years(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  grade_id uuid NOT NULL REFERENCES grades(id),
  stream_id uuid REFERENCES streams(id),
  student_category text NOT NULL
    CHECK (student_category IN ('NEW', 'EXISTING', 'RETURNING')),
  status text NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (status IN (
      'PENDING_REVIEW', 'REJECTED', 'PAYMENT_PENDING', 'ENROLLED',
      'WAITLISTED', 'WAITLIST_NOTIFIED', 'WAITLIST_EXPIRED',
      'EXPIRED', 'CANCELLED'
    )),
  fee_structure_id uuid REFERENCES fee_structures(id),
  payment_deadline_at timestamptz,
  waitlisted_at timestamptz,
  waitlist_notify_deadline_at timestamptz,
  expired_count integer NOT NULL DEFAULT 0,
  academic_result text NOT NULL DEFAULT 'PENDING'
    CHECK (academic_result IN ('PENDING', 'PASSED', 'FAILED')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One active enrollment per student per year
  UNIQUE (student_id, academic_year_id)
);
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE TABLE enrollment_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id),
  from_status text,
  to_status text NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  actor_role text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE enrollment_transitions ENABLE ROW LEVEL SECURITY;

CREATE TABLE document_requirement_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL,
  student_category text NOT NULL
    CHECK (student_category IN ('NEW', 'EXISTING', 'RETURNING', 'ALL')),
  is_required boolean NOT NULL DEFAULT true,
  is_reusable boolean NOT NULL DEFAULT false,
  requires_fresh_upload boolean NOT NULL DEFAULT true,
  applies_to_grade_id uuid REFERENCES grades(id),
  applies_when_entering_grade_id uuid REFERENCES grades(id),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE document_requirement_rules ENABLE ROW LEVEL SECURITY;

CREATE TABLE predefined_rejection_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL,
  reason_text text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE predefined_rejection_reasons ENABLE ROW LEVEL SECURITY;

CREATE TABLE enrollment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id),
  student_id uuid NOT NULL REFERENCES students(id),
  academic_year_id uuid NOT NULL REFERENCES academic_years(id),
  doc_type text NOT NULL,
  cloudinary_public_id text NOT NULL,
  cloudinary_version text,
  is_reused_from_enrollment_id uuid REFERENCES enrollments(id),
  uploaded_by_guardian_id uuid REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  verification_status text NOT NULL DEFAULT 'PENDING'
    CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  rejection_reason_id uuid REFERENCES predefined_rejection_reasons(id),
  rejection_note text,
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE enrollment_documents ENABLE ROW LEVEL SECURITY;


-- Script 7: Payment and webhook tables

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id),
  guardian_id uuid NOT NULL REFERENCES users(id),
  tx_ref text NOT NULL UNIQUE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'ETB',
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED')),
  source text NOT NULL DEFAULT 'CHAPA'
    CHECK (source IN ('CHAPA', 'MANUAL_ADMIN_OVERRIDE')),
  chapa_reference text,
  internal_receipt_ref text,
  override_reason text,
  override_by uuid REFERENCES users(id),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE TABLE manual_payment_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id),
  guardian_id uuid NOT NULL REFERENCES users(id),
  submitted_tx_ref text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  reviewed_by uuid REFERENCES users(id),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE manual_payment_claims ENABLE ROW LEVEL SECURITY;

CREATE TABLE webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'CHAPA',
  raw_payload jsonb NOT NULL,
  signature_valid boolean NOT NULL,
  processing_status text NOT NULL DEFAULT 'RECEIVED'
    CHECK (processing_status IN ('RECEIVED', 'PROCESSED', 'DUPLICATE', 'REJECTED', 'FAILED')),
  failure_reason text,
  tx_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;


-- Script 8: Supporting tables

CREATE TABLE sms_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_phone text NOT NULL,
  message_body text NOT NULL,
  trigger_event text NOT NULL,
  related_id uuid,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  retry_count integer NOT NULL DEFAULT 0,
  last_attempted_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sms_queue ENABLE ROW LEVEL SECURITY;

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id),
  actor_role text,
  action_type text NOT NULL,
  target_table text,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- Audit logs are append-only — no updates, no deletes, ever

CREATE TABLE platform_billing_counter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL UNIQUE REFERENCES academic_years(id),
  total_successful_enrollments integer NOT NULL DEFAULT 0,
  last_updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE platform_billing_counter ENABLE ROW LEVEL SECURITY;

-- Script 9: Helper functions used in RLS policies

-- Returns the role of the currently authenticated user
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$;

-- Returns the branch ID assigned to the currently authenticated branch admin
CREATE OR REPLACE FUNCTION get_my_branch_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT assigned_branch_id FROM admin_profiles WHERE user_id = auth.uid()
$$;

-- Returns true if the current user has verified MFA in their session
-- Used in RLS policies for admin tables
-- Session metadata set server-side after TOTP verification
CREATE OR REPLACE FUNCTION is_mfa_verified()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'mfa_verified')::boolean,
    false
  )
$$;

-- Script 10: Scaffolded RLS policies
-- These will be hardened and fully tested in Phase 8
-- Every table gets at least a deny-all policy now so nothing is accidentally open

-- USERS table
CREATE POLICY "users_read_own" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_master_admin_all" ON users
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- GUARDIAN_PROFILES table
CREATE POLICY "guardian_profile_own" ON guardian_profiles
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "guardian_profiles_master_admin" ON guardian_profiles
  FOR SELECT USING (get_my_role() = 'MASTER_ADMIN');

-- ADMIN_PROFILES table
CREATE POLICY "admin_profile_own" ON admin_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admin_profiles_master_admin" ON admin_profiles
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- ADMIN_MFA table
CREATE POLICY "admin_mfa_own" ON admin_mfa
  FOR ALL USING (admin_id = auth.uid());

-- BRANCHES table — readable by all authenticated users
CREATE POLICY "branches_read_authenticated" ON branches
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "branches_master_admin_write" ON branches
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- GRADES table — readable by all authenticated users
CREATE POLICY "grades_read_authenticated" ON grades
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "grades_master_admin_write" ON grades
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- STREAMS table — readable by all authenticated users
CREATE POLICY "streams_read_authenticated" ON streams
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "streams_master_admin_write" ON streams
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- BRANCH_GRADE_CONFIGS — readable by authenticated, write by master admin
CREATE POLICY "branch_grade_configs_read" ON branch_grade_configs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "branch_grade_configs_master_admin_write" ON branch_grade_configs
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- BRANCH_GRADE_STREAM_CONFIGS
CREATE POLICY "branch_grade_stream_configs_read" ON branch_grade_stream_configs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "branch_grade_stream_configs_master_admin_write" ON branch_grade_stream_configs
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- GRADE_PROGRESSION_RULES
CREATE POLICY "grade_progression_rules_read" ON grade_progression_rules
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "grade_progression_rules_master_admin_write" ON grade_progression_rules
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- ACADEMIC_YEARS — readable by authenticated
CREATE POLICY "academic_years_read" ON academic_years
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "academic_years_master_admin_write" ON academic_years
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- GRADE_CAPACITIES — readable by authenticated
CREATE POLICY "grade_capacities_read" ON grade_capacities
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "grade_capacities_master_admin_write" ON grade_capacities
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- FEE_STRUCTURES — readable by authenticated
CREATE POLICY "fee_structures_read" ON fee_structures
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "fee_structures_master_admin_write" ON fee_structures
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- STUDENTS — guardian sees only their linked students
CREATE POLICY "students_guardian_own" ON students
  FOR SELECT USING (
    id IN (
      SELECT student_id FROM guardian_student_links
      WHERE guardian_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "students_admin_read" ON students
  FOR SELECT USING (
    get_my_role() IN ('BRANCH_ADMIN', 'MASTER_ADMIN')
  );

CREATE POLICY "students_master_admin_write" ON students
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- GUARDIAN_STUDENT_LINKS
CREATE POLICY "guardian_student_links_own" ON guardian_student_links
  FOR SELECT USING (guardian_id = auth.uid());

CREATE POLICY "guardian_student_links_master_admin" ON guardian_student_links
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- ENROLLMENTS — guardian sees own, branch admin sees own branch
CREATE POLICY "enrollments_guardian_own" ON enrollments
  FOR SELECT USING (guardian_id = auth.uid());

CREATE POLICY "enrollments_branch_admin_own_branch" ON enrollments
  FOR SELECT USING (
    branch_id = get_my_branch_id()
    AND get_my_role() = 'BRANCH_ADMIN'
  );

CREATE POLICY "enrollments_master_admin" ON enrollments
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- ENROLLMENT_TRANSITIONS — append only, no updates/deletes
CREATE POLICY "enrollment_transitions_guardian_read" ON enrollment_transitions
  FOR SELECT USING (
    enrollment_id IN (
      SELECT id FROM enrollments WHERE guardian_id = auth.uid()
    )
  );

CREATE POLICY "enrollment_transitions_admin_read" ON enrollment_transitions
  FOR SELECT USING (
    get_my_role() IN ('BRANCH_ADMIN', 'MASTER_ADMIN')
  );

CREATE POLICY "enrollment_transitions_insert_authenticated" ON enrollment_transitions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ENROLLMENT_DOCUMENTS
CREATE POLICY "enrollment_documents_guardian_own" ON enrollment_documents
  FOR SELECT USING (uploaded_by_guardian_id = auth.uid());

CREATE POLICY "enrollment_documents_admin_read" ON enrollment_documents
  FOR SELECT USING (
    get_my_role() IN ('BRANCH_ADMIN', 'MASTER_ADMIN')
  );

CREATE POLICY "enrollment_documents_master_admin_write" ON enrollment_documents
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- DOCUMENT_REQUIREMENT_RULES
CREATE POLICY "document_requirement_rules_read" ON document_requirement_rules
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "document_requirement_rules_master_admin_write" ON document_requirement_rules
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- PREDEFINED_REJECTION_REASONS
CREATE POLICY "predefined_rejection_reasons_read" ON predefined_rejection_reasons
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "predefined_rejection_reasons_master_admin_write" ON predefined_rejection_reasons
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- PAYMENTS — guardian sees own
CREATE POLICY "payments_guardian_own" ON payments
  FOR SELECT USING (guardian_id = auth.uid());

CREATE POLICY "payments_admin_read" ON payments
  FOR SELECT USING (
    get_my_role() IN ('BRANCH_ADMIN', 'MASTER_ADMIN')
  );

CREATE POLICY "payments_master_admin_write" ON payments
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- MANUAL_PAYMENT_CLAIMS
CREATE POLICY "manual_payment_claims_guardian_own" ON manual_payment_claims
  FOR SELECT USING (guardian_id = auth.uid());

CREATE POLICY "manual_payment_claims_admin_read" ON manual_payment_claims
  FOR SELECT USING (
    get_my_role() IN ('BRANCH_ADMIN', 'MASTER_ADMIN')
  );

-- WEBHOOK_LOGS — server-side only via admin client
CREATE POLICY "webhook_logs_master_admin_read" ON webhook_logs
  FOR SELECT USING (get_my_role() = 'MASTER_ADMIN');

-- SMS_QUEUE — server-side only
CREATE POLICY "sms_queue_master_admin_read" ON sms_queue
  FOR SELECT USING (get_my_role() = 'MASTER_ADMIN');

-- AUDIT_LOGS — master admin read only, no writes via RLS
CREATE POLICY "audit_logs_master_admin_read" ON audit_logs
  FOR SELECT USING (get_my_role() = 'MASTER_ADMIN');

-- CLAIM_REQUESTS
CREATE POLICY "claim_requests_guardian_own" ON claim_requests
  FOR SELECT USING (claimed_guardian_id = auth.uid());

CREATE POLICY "claim_requests_master_admin" ON claim_requests
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- GUARDIAN_RECOVERY_REQUESTS
CREATE POLICY "recovery_requests_own" ON guardian_recovery_requests
  FOR SELECT USING (new_guardian_id = auth.uid());

CREATE POLICY "recovery_requests_master_admin" ON guardian_recovery_requests
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

-- PLATFORM_BILLING_COUNTER
CREATE POLICY "billing_counter_master_admin" ON platform_billing_counter
  FOR ALL USING (get_my_role() = 'MASTER_ADMIN');

  -- Script 11: Auto-create users row on first Google sign-in

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'GUARDIAN'  -- Default role — Master Admin manually upgrades admins
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
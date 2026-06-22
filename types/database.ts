// types/database.ts
// TypeScript types for every database table
// These mirror the exact schema created in Phase 0 Step 4
// Never use `any` — every field typed explicitly

// -------------------------
// Enums
// -------------------------

export type UserRole = "GUARDIAN" | "BRANCH_ADMIN" | "MASTER_ADMIN"
export type UserStatus = "ACTIVE" | "DEACTIVATED"

export type AcademicYearStatus =
  | "CONFIGURATION"
  | "OPEN"
  | "CLOSED"
  | "ARCHIVED"

export type StudentCategory = "NEW" | "EXISTING" | "RETURNING"
export type StudentStatus = "ACTIVE" | "MERGED" | "DEACTIVATED"
export type AcademicResult = "PENDING" | "PASSED" | "FAILED"
export type Gender = "MALE" | "FEMALE"

export type EnrollmentStatus =
  | "PENDING_REVIEW"
  | "REJECTED"
  | "PAYMENT_PENDING"
  | "ENROLLED"
  | "WAITLISTED"
  | "WAITLIST_NOTIFIED"
  | "WAITLIST_EXPIRED"
  | "EXPIRED"
  | "CANCELLED"

export type DocumentVerificationStatus = "PENDING" | "VERIFIED" | "REJECTED"

export type PaymentStatus = "PENDING" | "CONFIRMED" | "FAILED" | "EXPIRED"
export type PaymentSource = "CHAPA" | "MANUAL_ADMIN_OVERRIDE"

export type ManualClaimStatus = "PENDING" | "VERIFIED" | "REJECTED"

export type WebhookProcessingStatus =
  | "RECEIVED"
  | "PROCESSED"
  | "DUPLICATE"
  | "REJECTED"
  | "FAILED"

export type SmsStatus = "PENDING" | "SENT" | "FAILED"

export type ClaimRequestStatus = "PENDING" | "APPROVED" | "REJECTED"

export type RecoveryRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PHYSICAL_VISIT_REQUIRED"

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW"

export type GuardianLinkType = "PRIMARY" | "CO_GUARDIAN"

// -------------------------
// Table row types
// -------------------------

export interface User {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  status: UserStatus
  recovery_transferred_to: string | null
  created_at: string
  updated_at: string
}

export interface GuardianProfile {
  id: string
  user_id: string
  full_name: string
  phone: string
  fan_fin_encrypted: string // never returned to frontend
  national_id_front_public_id: string
  national_id_back_public_id: string
  residential_address: string
  is_complete: boolean
  created_at: string
  updated_at: string
}

export interface AdminProfile {
  id: string
  user_id: string
  full_name: string
  assigned_branch_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AdminMfa {
  id: string
  admin_id: string
  totp_secret_encrypted: string // never returned to frontend
  backup_codes_hashed: string[] // never returned to frontend
  is_configured: boolean
  configured_at: string | null
  last_verified_at: string | null
  failed_attempts: number
  locked_until: string | null
  created_at: string
}

export interface Branch {
  id: string
  name: string
  code: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Grade {
  id: string
  name: string
  level_order: number
  is_active: boolean
  created_at: string
}

export interface Stream {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface BranchGradeConfig {
  id: string
  branch_id: string
  grade_id: string
  academic_year_id: string
  is_active: boolean
  created_at: string
}

export interface BranchGradeStreamConfig {
  id: string
  branch_id: string
  grade_id: string
  stream_id: string
  academic_year_id: string
  is_active: boolean
  created_at: string
}

export interface GradeProgressionRule {
  id: string
  from_grade_id: string
  from_branch_id: string
  to_grade_id: string
  to_branch_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AcademicYear {
  id: string
  name: string
  start_year: number
  end_year: number
  status: AcademicYearStatus
  created_at: string
  updated_at: string
}

export interface GradeCapacity {
  id: string
  academic_year_id: string
  branch_id: string
  grade_id: string
  stream_id: string | null
  total_seats: number
  pending_seats: number
  reserved_seats: number
  enrolled_seats: number
  waitlist_capacity: number
  waitlist_count: number
  waitlist_window_hours: number
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  stu_id: string
  full_name: string
  full_name_normalized: string
  date_of_birth: string
  dob_normalized: string
  gender: Gender
  status: StudentStatus
  merged_into_student_id: string | null
  created_at: string
  updated_at: string
}

export interface GuardianStudentLink {
  id: string
  guardian_id: string
  student_id: string
  link_type: GuardianLinkType
  is_active: boolean
  invite_token: string | null
  invite_token_expires_at: string | null
  invited_by_guardian_id: string | null
  created_at: string
  updated_at: string
}

export interface ClaimRequest {
  id: string
  claimed_guardian_id: string
  matched_student_id: string
  confidence_score: number
  submitted_details: Record<string, unknown>
  status: ClaimRequestStatus
  reviewed_by: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export interface GuardianRecoveryRequest {
  id: string
  new_guardian_id: string
  claimed_full_name: string
  claimed_phone: string
  claimed_fan_fin_encrypted: string // never returned to frontend
  national_id_front_public_id: string
  national_id_back_public_id: string
  claimed_student_name: string
  claimed_student_dob: string
  recovery_reason: string
  confidence_level: ConfidenceLevel
  matched_guardian_id: string | null
  status: RecoveryRequestStatus
  reviewed_by: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export interface FeeStructure {
  id: string
  academic_year_id: string
  branch_id: string
  grade_id: string
  stream_id: string | null
  registration_fee: number
  first_month_fee: number
  total_amount: number
  effective_from: string
  effective_until: string | null
  created_at: string
  updated_at: string
}

export interface Enrollment {
  id: string
  student_id: string
  guardian_id: string
  academic_year_id: string
  branch_id: string
  grade_id: string
  stream_id: string | null
  student_category: StudentCategory
  status: EnrollmentStatus
  fee_structure_id: string | null
  payment_deadline_at: string | null
  waitlisted_at: string | null
  waitlist_notify_deadline_at: string | null
  expired_count: number
  academic_result: AcademicResult
  submitted_at: string
  created_at: string
  updated_at: string
}

export interface EnrollmentTransition {
  id: string
  enrollment_id: string
  from_status: EnrollmentStatus | null
  to_status: EnrollmentStatus
  actor_id: string
  actor_role: UserRole
  reason: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface DocumentRequirementRule {
  id: string
  doc_type: string
  student_category: StudentCategory | "ALL"
  is_required: boolean
  is_reusable: boolean
  requires_fresh_upload: boolean
  applies_to_grade_id: string | null
  applies_when_entering_grade_id: string | null
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PredefinedRejectionReason {
  id: string
  doc_type: string
  reason_text: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EnrollmentDocument {
  id: string
  enrollment_id: string
  student_id: string
  academic_year_id: string
  doc_type: string
  cloudinary_public_id: string
  cloudinary_version: string | null
  is_reused_from_enrollment_id: string | null
  uploaded_by_guardian_id: string | null
  uploaded_at: string
  verification_status: DocumentVerificationStatus
  rejection_reason_id: string | null
  rejection_note: string | null
  verified_by: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  enrollment_id: string
  guardian_id: string
  tx_ref: string
  amount: number
  currency: string
  status: PaymentStatus
  source: PaymentSource
  chapa_reference: string | null
  internal_receipt_ref: string | null
  override_reason: string | null
  override_by: string | null
  confirmed_at: string | null
  created_at: string
  updated_at: string
}

export interface ManualPaymentClaim {
  id: string
  enrollment_id: string
  guardian_id: string
  submitted_tx_ref: string
  status: ManualClaimStatus
  reviewed_by: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export interface WebhookLog {
  id: string
  provider: string
  raw_payload: Record<string, unknown>
  signature_valid: boolean
  processing_status: WebhookProcessingStatus
  failure_reason: string | null
  tx_ref: string | null
  created_at: string
}

export interface SmsQueue {
  id: string
  recipient_phone: string
  message_body: string
  trigger_event: string
  related_id: string | null
  status: SmsStatus
  retry_count: number
  last_attempted_at: string | null
  sent_at: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  actor_id: string | null
  actor_role: string | null
  action_type: string
  target_table: string | null
  target_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface PlatformBillingCounter {
  id: string
  academic_year_id: string
  total_successful_enrollments: number
  last_updated_at: string
}


export type CoGuardianInviteStatus =
  | "PENDING"
  | "ACCEPTED"
  | "EXPIRED"
  | "REVOKED"

export interface CoGuardianInvite {
  id: string
  student_id: string
  invited_phone: string
  invite_token: string
  invite_token_expires_at: string
  invited_by_guardian_id: string
  status: CoGuardianInviteStatus
  accepted_by_guardian_id: string | null
  accepted_at: string | null
  created_at: string
  updated_at: string
}
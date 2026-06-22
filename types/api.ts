// types/api.ts
// Shared API request and response types
// Used across all API routes for consistent response shapes

// Standard API error response
export interface ApiError {
  error: string
}

// Standard API success response
export interface ApiSuccess<T = void> {
  data?: T
  message?: string
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// Safe user type — never includes sensitive fields
export interface SafeUser {
  id: string
  email: string
  full_name: string | null
  role: import("./database").UserRole
  status: import("./database").UserStatus
}

// Safe guardian profile — fan_fin_encrypted never included
export interface SafeGuardianProfile {
  id: string
  user_id: string
  full_name: string
  phone: string
  national_id_front_public_id: string
  national_id_back_public_id: string
  residential_address: string
  is_complete: boolean
}

// Enrollment with joined data for display
export interface EnrollmentWithDetails {
  id: string
  student_id: string
  student_name: string
  stu_id: string
  academic_year_id: string
  academic_year_name: string
  branch_id: string
  branch_name: string
  grade_id: string
  grade_name: string
  stream_id: string | null
  stream_name: string | null
  student_category: import("./database").StudentCategory
  status: import("./database").EnrollmentStatus
  academic_result: import("./database").AcademicResult
  payment_deadline_at: string | null
  waitlisted_at: string | null
  waitlist_notify_deadline_at: string | null
  submitted_at: string
}

// Document with signed view URL
export interface DocumentWithUrl {
  id: string
  doc_type: string
  verification_status: import("./database").DocumentVerificationStatus
  rejection_reason: string | null
  rejection_note: string | null
  is_reused: boolean
  uploaded_at: string
  signed_url: string // 15 minute expiry — never raw Cloudinary URL
}

// Seat availability for display
export interface SeatAvailability {
  grade_id: string
  grade_name: string
  stream_id: string | null
  stream_name: string | null
  total_seats: number
  available_seats: number
  waitlist_count: number
  waitlist_capacity: number
  is_full: boolean
  waitlist_open: boolean
}
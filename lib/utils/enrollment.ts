// lib/utils/enrollment.ts
// Enrollment utility helpers used throughout Phase 4

import { createAdminClient } from "@/lib/supabase/admin"
import type { AcademicYear } from "@/types/database"

/**
 * Get the currently OPEN academic year.
 * Returns null if no year is currently OPEN.
 */
export async function getOpenAcademicYear(): Promise<AcademicYear | null> {
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from("academic_years")
    .select("*")
    .eq("status", "OPEN")
    .single()

  return data ?? null
}

/**
 * Check if enrollment is currently open.
 * Used as a gate before any enrollment operation.
 */
export async function isEnrollmentOpen(): Promise<boolean> {
  const year = await getOpenAcademicYear()
  return year !== null
}

/**
 * Get the most recent enrollment for a student.
 * Used for category detection and grade gate.
 */
export async function getMostRecentEnrollment(
  studentId: string
): Promise<{
  id: string
  academic_year_id: string
  grade_id: string
  branch_id: string
  status: string
  academic_result: string
} | null> {
  const adminClient = createAdminClient()

  // Get all academic years ordered by start_year descending
  const { data: years } = await adminClient
    .from("academic_years")
    .select("id, start_year")
    .order("start_year", { ascending: false })

  if (!years || years.length === 0) return null

  // Find the most recent enrollment across all years
  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(
      "id, academic_year_id, grade_id, branch_id, status, academic_result"
    )
    .eq("student_id", studentId)
    .not("status", "in", '("CANCELLED")')
    .order("submitted_at", { ascending: false })
    .limit(1)
    .single()

  return enrollment ?? null
}

/**
 * Detect student category based on enrollment history.
 * NEW: no previous enrollment ever
 * EXISTING: enrolled in immediately previous academic year
 * RETURNING: enrolled in older year but not previous year
 */
export async function detectStudentCategory(
  studentId: string,
  currentAcademicYearId: string
): Promise<"NEW" | "EXISTING" | "RETURNING"> {
  const adminClient = createAdminClient()

  // Check if student has any enrollment at all
  const { count: totalEnrollments } = await adminClient
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .not("status", "in", '("CANCELLED")')

  if ((totalEnrollments ?? 0) === 0) {
    return "NEW"
  }

  // Get the immediately previous academic year
  const { data: currentYear } = await adminClient
    .from("academic_years")
    .select("start_year")
    .eq("id", currentAcademicYearId)
    .single()

  if (!currentYear) return "RETURNING"

  const { data: previousYear } = await adminClient
    .from("academic_years")
    .select("id")
    .eq("start_year", currentYear.start_year - 1)
    .single()

  if (!previousYear) {
    // No previous year configured — treat as RETURNING
    return "RETURNING"
  }

  // Check if student was enrolled in immediately previous year
  const { count: previousEnrollment } = await adminClient
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("academic_year_id", previousYear.id)
    .not("status", "in", '("CANCELLED")')

  if ((previousEnrollment ?? 0) > 0) {
    return "EXISTING"
  }

  return "RETURNING"
}
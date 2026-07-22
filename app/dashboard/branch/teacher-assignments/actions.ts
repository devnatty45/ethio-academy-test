// app/dashboard/branch/teacher-assignments/actions.ts
// Purpose: Server actions for Branch Admin teacher-subject assignment
"use server"

import { requireRole, requireMfaVerified } from "@/lib/supabase/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export async function assignTeacherToSubject(
  sectionId: string,
  subjectId: string,
  teacherId: string,
  academicYearId: string
) {
  const user = await requireRole("BRANCH_ADMIN")
  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from("teacher_subject_assignments")
    .upsert(
      {
        section_id: sectionId,
        subject_id: subjectId,
        teacher_id: teacherId,
        academic_year_id: academicYearId,
        assigned_by: user.id,
        is_active: true,
      },
      { onConflict: "section_id,subject_id" }
    )

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/branch/teacher-assignments")
  return { success: true }
}

export async function removeAssignment(assignmentId: string) {
  const user = await requireRole("BRANCH_ADMIN")
  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from("teacher_subject_assignments")
    .delete()
    .eq("id", assignmentId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/branch/teacher-assignments")
  return { success: true }
}

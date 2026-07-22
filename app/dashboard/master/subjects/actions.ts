// app/dashboard/master/subjects/actions.ts
// Purpose: Server actions for Master Admin subject management
"use server"

import { requireRole, requireMfaVerified } from "@/lib/supabase/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export async function createSubject(formData: FormData) {
  const user = await requireRole("MASTER_ADMIN")
  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()

  const gradeId = formData.get("grade_id") as string
  const streamId = (formData.get("stream_id") as string) || null
  const name = (formData.get("name") as string)?.trim()
  const gradingType = formData.get("grading_type") as string
  const passMark = parseFloat(formData.get("pass_mark_percent") as string) || 50

  if (!gradeId || !name || !gradingType) {
    return { error: "Grade, name, and grading type are required." }
  }

  const { error } = await adminClient.from("subjects").insert({
    grade_id: gradeId,
    stream_id: streamId,
    name,
    grading_type: gradingType,
    pass_mark_percent: passMark,
  })

  if (error) {
    if (error.code === "23505") {
      return { error: "This subject already exists for this grade/stream." }
    }
    return { error: error.message }
  }

  revalidatePath("/dashboard/master/subjects")
  return { success: true }
}

export async function toggleSubjectActive(subjectId: string, isActive: boolean) {
  const user = await requireRole("MASTER_ADMIN")
  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from("subjects")
    .update({ is_active: isActive })
    .eq("id", subjectId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/master/subjects")
  return { success: true }
}

export async function deleteSubject(subjectId: string) {
  const user = await requireRole("MASTER_ADMIN")
  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()

  const { error } = await adminClient.from("subjects").delete().eq("id", subjectId)

  if (error) {
    // Likely a foreign key constraint (subject already in use by marks/assignments)
    return { error: "Could not delete — this subject may already be in use. Try deactivating it instead." }
  }

  revalidatePath("/dashboard/master/subjects")
  return { success: true }
}

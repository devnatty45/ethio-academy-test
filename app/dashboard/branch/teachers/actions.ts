// app/dashboard/branch/teachers/actions.ts
// Purpose: Server actions for Branch Admin teacher approval workflow
"use server"

import { requireRole, requireMfaVerified } from "@/lib/supabase/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export async function searchTeacherByEmail(email: string) {
  const user = await requireRole("BRANCH_ADMIN")
  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from("users")
    .select(`
      id, email, full_name,
      teacher_profiles!teacher_profiles_user_id_fkey (
        id, full_name, phone, branch_id, status, created_at,
        branches (name)
      )
    `)
    .eq("role", "TEACHER")
    .ilike("email", `%${email}%`)
    .limit(10)

  if (error) {
    console.error("Teacher search error:", error)
    return { error: `Search failed: ${error.message}` }
  }

  return { results: data }
}

export async function approveTeacher(teacherProfileId: string, branchId: string) {
  const user = await requireRole("BRANCH_ADMIN")
  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from("teacher_profiles")
    .update({
      status: "ACTIVE",
      branch_id: branchId,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", teacherProfileId)

  if (error) {
    return { error: "Could not approve teacher. Please try again." }
  }

  revalidatePath("/dashboard/branch/teachers")
  return { success: true }
}

export async function suspendTeacher(teacherProfileId: string) {
  const user = await requireRole("BRANCH_ADMIN")
  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from("teacher_profiles")
    .update({ status: "SUSPENDED" })
    .eq("id", teacherProfileId)

  if (error) {
    return { error: "Could not update teacher. Please try again." }
  }

  revalidatePath("/dashboard/branch/teachers")
  return { success: true }
}

export async function reactivateTeacher(teacherProfileId: string) {
  const user = await requireRole("BRANCH_ADMIN")
  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from("teacher_profiles")
    .update({ status: "ACTIVE" })
    .eq("id", teacherProfileId)

  if (error) {
    return { error: "Could not update teacher. Please try again." }
  }

  revalidatePath("/dashboard/branch/teachers")
  return { success: true }
}

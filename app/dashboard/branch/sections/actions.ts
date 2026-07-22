// app/dashboard/branch/sections/actions.ts
// Purpose: Server actions for Branch Admin section management
"use server"

import { requireRole, requireMfaVerified } from "@/lib/supabase/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

async function getMyBranchId(adminClient: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await adminClient
    .from("admin_profiles")
    .select("assigned_branch_id")
    .eq("user_id", userId)
    .single()
  return data?.assigned_branch_id as string | undefined
}

export async function createSection(formData: FormData) {
  const user = await requireRole("BRANCH_ADMIN")
  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()
  const branchId = await getMyBranchId(adminClient, user.id)

  if (!branchId) {
    return { error: "No branch assigned to your account." }
  }

  const gradeId = formData.get("grade_id") as string
  const streamId = (formData.get("stream_id") as string) || null
  const academicYearId = formData.get("academic_year_id") as string
  const name = (formData.get("name") as string)?.trim()
  const maxCapacity = parseInt(formData.get("max_capacity") as string, 10)

  if (!gradeId || !academicYearId || !name || !maxCapacity) {
    return { error: "All fields are required." }
  }

  const { error } = await adminClient.from("sections").insert({
    branch_id: branchId,
    grade_id: gradeId,
    stream_id: streamId,
    academic_year_id: academicYearId,
    name,
    max_capacity: maxCapacity,
  })

  if (error) {
    if (error.code === "23505") {
      return { error: "A section with this name already exists for this grade/stream/year." }
    }
    return { error: error.message }
  }

  revalidatePath("/dashboard/branch/sections")
  return { success: true }
}

export async function toggleSectionActive(sectionId: string, isActive: boolean) {
  const user = await requireRole("BRANCH_ADMIN")
  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()
  const branchId = await getMyBranchId(adminClient, user.id)

  const { error } = await adminClient
    .from("sections")
    .update({ is_active: isActive })
    .eq("id", sectionId)
    .eq("branch_id", branchId) // belt-and-suspenders, RLS already enforces this

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/branch/sections")
  return { success: true }
}

export async function deleteSection(sectionId: string) {
  const user = await requireRole("BRANCH_ADMIN")
  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()
  const branchId = await getMyBranchId(adminClient, user.id)

  const { error } = await adminClient
    .from("sections")
    .delete()
    .eq("id", sectionId)
    .eq("branch_id", branchId)

  if (error) {
    return { error: "Could not delete — this section may already have students or teachers assigned. Try deactivating it instead." }
  }

  revalidatePath("/dashboard/branch/sections")
  return { success: true }
}

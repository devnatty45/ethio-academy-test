// app/dashboard/branch/allocations/actions.ts
// Purpose: Server actions for Branch Admin student section allocation
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

export async function allocateStudent(enrollmentId: string, sectionId: string) {
  const user = await requireRole("BRANCH_ADMIN")
  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from("student_section_allocations")
    .upsert(
      { enrollment_id: enrollmentId, section_id: sectionId, allocated_by: user.id, is_active: true },
      { onConflict: "enrollment_id" }
    )

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/branch/allocations")
  return { success: true }
}

export async function unallocateStudent(enrollmentId: string) {
  const user = await requireRole("BRANCH_ADMIN")
  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from("student_section_allocations")
    .update({ is_active: false })
    .eq("enrollment_id", enrollmentId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/branch/allocations")
  return { success: true }
}

export async function autoSplitSections(
  gradeId: string,
  streamId: string | null,
  academicYearId: string
) {
  const user = await requireRole("BRANCH_ADMIN")
  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()
  const branchId = await getMyBranchId(adminClient, user.id)

  if (!branchId) {
    return { error: "No branch assigned to your account." }
  }

  // 1. Get active sections for this grade/stream/year, with current occupancy
  let sectionQuery = adminClient
    .from("sections")
    .select("id, name, max_capacity")
    .eq("branch_id", branchId)
    .eq("grade_id", gradeId)
    .eq("academic_year_id", academicYearId)
    .eq("is_active", true)
    .order("name")

  sectionQuery = streamId ? sectionQuery.eq("stream_id", streamId) : sectionQuery.is("stream_id", null)

  const { data: sections } = await sectionQuery

  if (!sections || sections.length === 0) {
    return { error: "No active sections exist for this grade/stream/year. Create sections first." }
  }

  const sectionIds = sections.map((s) => s.id)
  const { data: existingAllocations } = await adminClient
    .from("student_section_allocations")
    .select("section_id")
    .in("section_id", sectionIds)
    .eq("is_active", true)

  const occupancy: Record<string, number> = {}
  sections.forEach((s) => (occupancy[s.id] = 0))
  existingAllocations?.forEach((a) => {
    occupancy[a.section_id] = (occupancy[a.section_id] ?? 0) + 1
  })

  // 2. Get unallocated ENROLLED students for this grade/stream/year
  let enrollQuery = adminClient
    .from("enrollments")
    .select("id")
    .eq("branch_id", branchId)
    .eq("grade_id", gradeId)
    .eq("academic_year_id", academicYearId)
    .eq("status", "ENROLLED")

  enrollQuery = streamId ? enrollQuery.eq("stream_id", streamId) : enrollQuery.is("stream_id", null)

  const { data: allEnrolled } = await enrollQuery

  const { data: alreadyAllocated } = await adminClient
    .from("student_section_allocations")
    .select("enrollment_id")
    .in("enrollment_id", (allEnrolled ?? []).map((e) => e.id))
    .eq("is_active", true)

  const allocatedIds = new Set((alreadyAllocated ?? []).map((a) => a.enrollment_id))
  const unallocated = (allEnrolled ?? []).filter((e) => !allocatedIds.has(e.id))

  if (unallocated.length === 0) {
    return { error: "No unallocated students found for this grade/stream/year." }
  }

  // 3. Round-robin assign, always filling the section with the most remaining capacity next
  const inserts: { enrollment_id: string; section_id: string; allocated_by: string }[] = []
  let skipped = 0

  for (const enrollment of unallocated) {
    const target = sections
      .map((s) => ({ ...s, remaining: s.max_capacity - occupancy[s.id] }))
      .filter((s) => s.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining)[0]

    if (!target) {
      skipped++
      continue
    }

    inserts.push({ enrollment_id: enrollment.id, section_id: target.id, allocated_by: user.id })
    occupancy[target.id] += 1
  }

  if (inserts.length > 0) {
    const { error } = await adminClient.from("student_section_allocations").insert(inserts)
    if (error) {
      return { error: `Auto-split partially failed: ${error.message}` }
    }
  }

  revalidatePath("/dashboard/branch/allocations")
  return {
    success: true,
    allocated: inserts.length,
    skipped,
    message:
      skipped > 0
        ? `Allocated ${inserts.length} students. ${skipped} could not be placed — sections are full. Add more capacity or a new section.`
        : `Allocated ${inserts.length} students across ${sections.length} sections.`,
  }
}

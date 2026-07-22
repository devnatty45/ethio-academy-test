// app/dashboard/branch/teachers/page.tsx
// Purpose: Branch Admin — Manage Teachers (approve pending signups, view active/suspended)
import {
  requireRole,
  isAdminMfaConfigured,
  requireMfaVerified,
} from "@/lib/supabase/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import TeacherApprovalQueue from "@/components/admin/teacher-approval-queue"

export default async function ManageTeachersPage() {
  const user = await requireRole("BRANCH_ADMIN")

  const mfaConfigured = await isAdminMfaConfigured(user.id)
  if (!mfaConfigured) redirect("/dashboard/admin/mfa-setup")

  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()

  const { data: adminProfile } = await adminClient
    .from("admin_profiles")
    .select(`
      assigned_branch_id,
      branches!admin_profiles_assigned_branch_id_fkey (id, name)
    `)
    .eq("user_id", user.id)
    .single()

  const branch = Array.isArray(adminProfile?.branches)
    ? adminProfile?.branches[0]
    : adminProfile?.branches

  // All teacher_profiles for this branch (pending, active, suspended)
  // NOTE: teacher_profiles has TWO foreign keys to users (user_id and
  // approved_by), so the embed must be disambiguated with !constraint_name
  // or PostgREST throws an ambiguity error and this query silently fails.
  const { data: branchTeachers, error: teachersError } = await adminClient
    .from("teacher_profiles")
    .select(
      "id, full_name, phone, status, created_at, user_id, users!teacher_profiles_user_id_fkey(email)"
    )
    .eq("branch_id", adminProfile?.assigned_branch_id)
    .order("created_at", { ascending: false })

  if (teachersError) {
    console.error("Failed to load branch teachers:", teachersError)
  }

  const { data: allBranches } = await adminClient
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("name")

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f8f7ff] via-white to-[#f0eeff] dark:from-[#0a0a1a] dark:via-[#0d0d1a] dark:to-[#0f0f24] px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard/branch"
              className="text-sm text-gray-500 hover:text-[#6c63ff] transition-colors"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
              Manage Teachers
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {branch?.name} branch
            </p>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-[#13132b]/80 backdrop-blur-xl rounded-2xl border border-gray-100/50 dark:border-white/8 shadow-xl shadow-[#6c63ff]/5 p-6">
          <TeacherApprovalQueue
            initialTeachers={branchTeachers ?? []}
            branches={allBranches ?? []}
            currentBranchId={adminProfile?.assigned_branch_id ?? ""}
          />
        </div>
      </div>
    </div>
  )
}

// app/dashboard/branch/allocations/page.tsx
// Purpose: Branch Admin — Student Allocation (assign enrolled students to sections)
import {
  requireRole,
  isAdminMfaConfigured,
  requireMfaVerified,
} from "@/lib/supabase/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import StudentAllocationClient from "@/components/admin/student-allocation-client"

export default async function StudentAllocationPage() {
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

  const branchId = adminProfile?.assigned_branch_id

  const { data: academicYears } = await adminClient
    .from("academic_years")
    .select("id, name, status")
    .order("start_year", { ascending: false })

  const { data: grades } = await adminClient
    .from("grades")
    .select("id, name, level_order")
    .eq("is_active", true)
    .order("level_order")

  const { data: streams } = await adminClient
    .from("streams")
    .select("id, name")
    .eq("is_active", true)
    .order("name")

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f8f7ff] via-white to-[#f0eeff] dark:from-[#0a0a1a] dark:via-[#0d0d1a] dark:to-[#0f0f24] px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <Link
            href="/dashboard/branch"
            className="text-sm text-gray-500 hover:text-[#6c63ff] transition-colors"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            Student Allocation
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {branch?.name} branch — assign enrolled students to sections
          </p>
        </div>

        <div className="bg-white/80 dark:bg-[#13132b]/80 backdrop-blur-xl rounded-2xl border border-gray-100/50 dark:border-white/8 shadow-xl shadow-[#6c63ff]/5 p-6">
          <StudentAllocationClient
            branchId={branchId ?? ""}
            academicYears={academicYears ?? []}
            grades={grades ?? []}
            streams={streams ?? []}
          />
        </div>
      </div>
    </div>
  )
}

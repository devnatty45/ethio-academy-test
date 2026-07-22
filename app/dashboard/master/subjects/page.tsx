// app/dashboard/master/subjects/page.tsx
// Purpose: Master Admin — Manage Subjects (grade + stream aware curriculum list)
import {
  requireRole,
  isAdminMfaConfigured,
  requireMfaVerified,
} from "@/lib/supabase/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import SubjectManagerClient from "@/components/admin/subject-manager-client"

export default async function ManageSubjectsPage() {
  const user = await requireRole("MASTER_ADMIN")

  const mfaConfigured = await isAdminMfaConfigured(user.id)
  if (!mfaConfigured) redirect("/dashboard/admin/mfa-setup")

  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()

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

  const { data: subjects } = await adminClient
    .from("subjects")
    .select("id, grade_id, stream_id, name, grading_type, pass_mark_percent, is_active, grades(name, level_order), streams(name)")
    .order("name")

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f8f7ff] via-white to-[#f0eeff] dark:from-[#0a0a1a] dark:via-[#0d0d1a] dark:to-[#0f0f24] px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <Link
            href="/dashboard/master"
            className="text-sm text-gray-500 hover:text-[#6c63ff] transition-colors"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            Manage Subjects
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Curriculum is shared across all branches. Grade 11–12 subjects can be Common or stream-specific.
          </p>
        </div>

        <div className="bg-white/80 dark:bg-[#13132b]/80 backdrop-blur-xl rounded-2xl border border-gray-100/50 dark:border-white/8 shadow-xl shadow-[#6c63ff]/5 p-6">
          <SubjectManagerClient
            grades={grades ?? []}
            streams={streams ?? []}
            initialSubjects={subjects ?? []}
          />
        </div>
      </div>
    </div>
  )
}

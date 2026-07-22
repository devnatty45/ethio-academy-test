// app/dashboard/teacher/page.tsx
// Purpose: Teacher's main dashboard — approval gate + assigned grade/section list
// Who can see this: authenticated users with role = TEACHER
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"

export default async function TeacherDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  const adminClient = createAdminClient()

  const { data: userData } = await adminClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!userData || userData.role !== "TEACHER") {
    redirect("/auth/route-to-dashboard")
  }

  const { data: branchTeachers, error: teachersError } = await adminClient
  .from("teacher_profiles")
  .select("id, full_name, phone, status, created_at, user_id, users!teacher_profiles_user_id_fkey(email)")
  .eq("branch_id", adminProfile?.assigned_branch_id)
  .order("created_at", { ascending: false })

if (teachersError) {
  console.error("Failed to load branch teachers:", teachersError)
}

  if (!profile) {
    redirect("/auth/teacher-onboarding")
  }

  // ── PENDING APPROVAL STATE ──
  if (profile.status === "PENDING_APPROVAL") {
    return (
      <main className="min-h-screen bg-[#0a0d2e] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-white/10 px-8 py-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 bg-[#f5a623]/15 rounded-2xl flex items-center justify-center text-2xl">
            ⏳
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Waiting for Approval
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Hi {profile.full_name}, your teacher account for{" "}
            <span className="font-semibold">
              {(profile as any).branches?.name ?? "your branch"}
            </span>{" "}
            is pending review by a branch admin. You'll be able to access your
            gradebook once approved.
          </p>
        </div>
      </main>
    )
  }

  // ── SUSPENDED STATE ──
  if (profile.status === "SUSPENDED") {
    return (
      <main className="min-h-screen bg-[#0a0d2e] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-white/10 px-8 py-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 bg-red-500/15 rounded-2xl flex items-center justify-center text-2xl">
            🚫
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Account Suspended
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Your teacher account has been suspended. Please contact the school
            administration for assistance.
          </p>
        </div>
      </main>
    )
  }

  // ── ACTIVE STATE ──
  // teacher_subject_assignments doesn't exist yet — placeholder empty state for now
  const assignments: any[] = []

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0d2e] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#6c63ff] mb-1">
            Teacher Dashboard
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome, {profile.full_name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {(profile as any).branches?.name}
          </p>
        </div>

        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-white/10 p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            My Assigned Grades & Sections
          </h2>

          {assignments.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-gray-400">
                No subject or section assignments yet. A branch admin will
                assign you to a grade, section, and subject soon.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {/* Assignment cards will render here once teacher_subject_assignments exists */}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

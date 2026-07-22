// app/auth/teacher-onboarding/page.tsx
// Purpose: Teacher completes profile (branch + phone) after first Google sign-in
// Who can see this: authenticated users with role = TEACHER, no teacher_profiles row yet
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { submitTeacherOnboarding } from "./actions"

export default async function TeacherOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
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

  // Already onboarded? Don't show this form again
  const { data: existingProfile } = await adminClient
    .from("teacher_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single()

  if (existingProfile) {
    redirect("/dashboard/teacher")
  }

  const { data: branches } = await adminClient
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("name")

  return (
    <main className="min-h-screen bg-[#0a0d2e] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-white/10 px-8 py-10">
        <p className="text-xs font-semibold tracking-widest uppercase text-[#6c63ff] mb-2">
          Teacher Registration
        </p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">
          Complete your profile
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          A branch admin will review and approve your account before you can access your rosters.
        </p>

        {error === "missing_fields" && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/10 border border-red-200/50 rounded-lg px-4 py-3">
            Please fill in all fields.
          </div>
        )}
        {error === "submit_failed" && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/10 border border-red-200/50 rounded-lg px-4 py-3">
            Something went wrong. Please try again.
          </div>
        )}

        <form action={submitTeacherOnboarding} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              name="full_name"
              required
              defaultValue={user.user_metadata?.full_name ?? ""}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              required
              placeholder="09XXXXXXXX"
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Branch
            </label>
            <select
              name="branch_id"
              required
              defaultValue=""
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm text-gray-900 dark:text-white"
            >
              <option value="" disabled>
                Select your branch
              </option>
              {branches?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              If you're unsure, a branch admin can correct this during approval.
            </p>
          </div>

          <button
            type="submit"
            className="mt-2 w-full h-12 rounded-xl bg-[#6c63ff] hover:bg-[#5750d9] text-white font-semibold text-sm transition-colors"
          >
            Submit for Approval
          </button>
        </form>
      </div>
    </main>
  )
}

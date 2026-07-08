// app/dashboard/guardian/page.tsx
// Guardian dashboard — shows all students and their enrollment statuses
import { requireRole } from "@/lib/supabase/session"
import { isGuardianProfileComplete } from "@/lib/utils/guardian"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import GuardianDashboardClient from "@/components/guardian/guardian-dashboard-client"

export default async function GuardianDashboardPage() {
  const user = await requireRole("GUARDIAN")
  const profileComplete = await isGuardianProfileComplete(user.id)

  if (!profileComplete) {
    redirect("/dashboard/guardian/complete-profile")
  }

  const adminClient = createAdminClient()
  const { data: links } = await adminClient
    .from("guardian_student_links")
    .select(`
      id, link_type,
      students!inner (id, stu_id, full_name, date_of_birth, gender)
    `)
    .eq("guardian_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })

  const students = links ?? []

  return (
    <div className="min-h-screen bg-[#f8f7ff] dark:bg-[#0d0d1a] px-4 py-8 md:px-8">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-[#6c63ff] mb-1">
              Guardian Portal
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              My Students
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Monitor enrollment status and take action when needed.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* ── Log Out Form hitting your API route ── */}
            <form action="/api/auth/signout" method="POST">
              <Button 
                type="submit" 
                variant="ghost" 
                size="sm" 
                className="text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-950/30"
              >
                Log Out
              </Button>
            </form>

            <Button asChild variant="outline" size="sm" className="border-[#6c63ff]/30 text-[#6c63ff] hover:bg-[#6c63ff]/5 dark:border-[#6c63ff]/40 dark:text-[#9d97ff]">
              <Link href="/dashboard/guardian/add-student">
                + Add Student
              </Link>
            </Button>
            <Button asChild size="sm" className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white">
              <Link href="/dashboard/guardian/enroll">
                Enroll Student
              </Link>
            </Button>
          </div>
        </div>

        {/* ── Empty state ── */}
        {students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#6c63ff]/30 bg-white dark:bg-[#13132b] px-8 py-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#6c63ff]/10 flex items-center justify-center mx-auto text-3xl">
              🎓
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                No students added yet
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Add your child to begin the enrollment process.
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 pt-2">
              <Button asChild size="sm" className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white">
                <Link href="/dashboard/guardian/add-student">
                  Add Student
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="text-xs text-gray-400 hover:text-[#6c63ff]">
                <Link href="/dashboard/guardian/recovery">
                  Lost access to a previous account? Recover it
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <GuardianDashboardClient />
        )}

      </div>
    </div>
  )
}

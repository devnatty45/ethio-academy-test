// app/dashboard/guardian/enroll/page.tsx
// Enrollment start page — guardian selects which student to enroll
// Shows enrollment gate message if year is not OPEN

import { requireRole } from "@/lib/supabase/session"
import { isGuardianProfileComplete } from "@/lib/utils/guardian"
import { getOpenAcademicYear } from "@/lib/utils/enrollment"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function EnrollPage() {
  const user = await requireRole("GUARDIAN")

  const profileComplete = await isGuardianProfileComplete(user.id)
  if (!profileComplete) {
    redirect("/dashboard/guardian/complete-profile")
  }

  const openYear = await getOpenAcademicYear()

  const adminClient = createAdminClient()
  const { data: links } = await adminClient
    .from("guardian_student_links")
    .select(`
      id,
      link_type,
      students!inner (
        id, stu_id, full_name, date_of_birth, gender
      )
    `)
    .eq("guardian_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })

  const students = links ?? []

  // ── Enrollment closed ──
  if (!openYear) {
    return (
      <div className="min-h-screen bg-[#f8f7ff] dark:bg-[#0d0d1a] px-4 py-10">
        <div className="mx-auto max-w-lg space-y-8">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-[#6c63ff] mb-2">
              Guardian Portal
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Enrollment
            </h1>
          </div>

          <div className="rounded-2xl border border-gray-100 dark:border-white/8 bg-white dark:bg-[#13132b] shadow-sm px-8 py-14 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mx-auto text-2xl">
              🔒
            </div>
            <div>
              <p className="text-base font-bold text-gray-900 dark:text-white">
                Enrollment is currently closed
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed max-w-xs mx-auto">
                The school has not yet opened enrollment for the next academic year. Please check back later.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Enrollment open ──
  return (
    <div className="min-h-screen bg-[#f8f7ff] dark:bg-[#0d0d1a] px-4 py-10">
      <div className="mx-auto max-w-lg space-y-8">

        {/* Header */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-[#6c63ff] mb-2">
            Guardian Portal
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Enrollment
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              Open
            </span>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enrolling for <span className="font-semibold text-gray-700 dark:text-gray-300">{openYear.name}</span>. Select a student to begin.
            </p>
          </div>
        </div>

        {/* No students */}
        {students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#6c63ff]/30 bg-white dark:bg-[#13132b] shadow-sm px-8 py-14 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#6c63ff]/10 flex items-center justify-center mx-auto text-2xl">
              🎓
            </div>
            <div>
              <p className="text-base font-bold text-gray-900 dark:text-white">
                No students added yet
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Add a student first to begin the enrollment process.
              </p>
            </div>
            <Button asChild size="sm" className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white rounded-xl">
              <Link href="/dashboard/guardian/add-student">
                Add Student First
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {students.map((link) => {
              const student = Array.isArray(link.students)
                ? link.students[0]
                : link.students

              if (!student) return null

              return (
                <div
                  key={link.id}
                  className="rounded-2xl border border-gray-100 dark:border-white/8 bg-white dark:bg-[#13132b] shadow-sm px-5 py-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-[#6c63ff]/10 dark:bg-[#6c63ff]/20 flex items-center justify-center text-sm font-bold text-[#6c63ff] dark:text-[#9d97ff] shrink-0">
                      {student.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {student.full_name}
                        </p>
                        {link.link_type === "CO_GUARDIAN" && (
                          <span className="text-[10px] font-medium bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                            Co-guardian
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {student.stu_id} · {new Date(student.date_of_birth).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <Button asChild size="sm" className="shrink-0 bg-[#6c63ff] hover:bg-[#5a52e0] text-white rounded-xl text-xs font-semibold">
                    <Link href={`/dashboard/guardian/enroll/${student.id}`}>
                      Enroll →
                    </Link>
                  </Button>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
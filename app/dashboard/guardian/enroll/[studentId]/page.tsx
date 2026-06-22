// app/dashboard/guardian/enroll/[studentId]/page.tsx
// Student-specific enrollment page — shows grade gate and availability
// Redirects to existing enrollment if already enrolled this year

import { requireRole } from "@/lib/supabase/session"
import { isGuardianProfileComplete } from "@/lib/utils/guardian"
import { getOpenAcademicYear } from "@/lib/utils/enrollment"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import EnrollmentForm from "@/components/guardian/enrollment-form"

interface EnrollStudentPageProps {
  params: Promise<{ studentId: string }>
}

export default async function EnrollStudentPage({
  params,
}: EnrollStudentPageProps) {
  const user = await requireRole("GUARDIAN")

  const profileComplete = await isGuardianProfileComplete(user.id)
  if (!profileComplete) {
    redirect("/dashboard/guardian/complete-profile")
  }

  const openYear = await getOpenAcademicYear()
  if (!openYear) {
    redirect("/dashboard/guardian/enroll")
  }

  const { studentId } = await params
  const adminClient = createAdminClient()

  const { data: link } = await adminClient
    .from("guardian_student_links")
    .select("id")
    .eq("guardian_id", user.id)
    .eq("student_id", studentId)
    .eq("is_active", true)
    .single()

  if (!link) {
    redirect("/dashboard/guardian/enroll")
  }

  const { data: student } = await adminClient
    .from("students")
    .select("id, stu_id, full_name, date_of_birth, gender")
    .eq("id", studentId)
    .single()

  if (!student) {
    redirect("/dashboard/guardian/enroll")
  }

  const { data: existingEnrollment } = await adminClient
    .from("enrollments")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("academic_year_id", openYear.id)
    .not("status", "in", '("CANCELLED")')
    .single()

  if (existingEnrollment) {
    redirect(`/dashboard/guardian/enrollments/${existingEnrollment.id}`)
  }

  return (
    <div className="min-h-screen bg-[#f8f7ff] dark:bg-[#0d0d1a] px-4 py-10">
      <div className="mx-auto max-w-lg space-y-8">

        {/* Header */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-[#6c63ff] mb-2">
            Enrollment
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Enroll {student.full_name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Academic year:{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-300">{openYear.name}</span>
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-gray-100 dark:border-white/8 bg-white dark:bg-[#13132b] shadow-sm p-6 sm:p-8">
          <EnrollmentForm
            studentId={studentId}
            studentName={student.full_name}
            openYearId={openYear.id}
            openYearName={openYear.name}
          />
        </div>

      </div>
    </div>
  )
}
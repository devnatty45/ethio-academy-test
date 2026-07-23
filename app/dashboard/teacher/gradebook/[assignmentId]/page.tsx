// app/dashboard/teacher/gradebook/[assignmentId]/page.tsx
// Purpose: Teacher's mark-entry roster for one section+subject assignment
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect, notFound } from "next/navigation"
import Link from "next/link" 
import GradebookClient from "@/components/teacher/gradebook-client"

export default async function GradebookPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>
}) {
  const { assignmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/")

  const adminClient = createAdminClient()

  const { data: teacherProfile } = await adminClient
    .from("teacher_profiles")
    .select("id, status")
    .eq("user_id", user.id)
    .single()

  if (!teacherProfile || teacherProfile.status !== "ACTIVE") {
    redirect("/dashboard/teacher")
  }

  // Confirm this assignment actually belongs to this teacher
  const { data: assignment } = await adminClient
    .from("teacher_subject_assignments")
    .select(`
      id, section_id, subject_id, academic_year_id,
      sections (name, grade_id, stream_id, grades(name), streams(name)),
      subjects (name, grading_type, pass_mark_percent)
    `)
    .eq("id", assignmentId)
    .eq("teacher_id", teacherProfile.id)
    .eq("is_active", true)
    .single()

  if (!assignment) notFound()

  const section = Array.isArray(assignment.sections) ? assignment.sections[0] : assignment.sections
  const subject = Array.isArray(assignment.subjects) ? assignment.subjects[0] : assignment.subjects
  const grade = Array.isArray(section?.grades) ? section?.grades[0] : section?.grades
  const stream = Array.isArray(section?.streams) ? section?.streams[0] : section?.streams

  // Terms for this academic year
  const { data: terms } = await adminClient
    .from("terms")
    .select("id, name, term_order, status")
    .eq("academic_year_id", assignment.academic_year_id)
    .order("term_order")

  // Students currently allocated to this section
  const { data: allocations } = await adminClient
    .from("student_section_allocations")
    .select("enrollment_id, enrollments(id, students(full_name, stu_id))")
    .eq("section_id", assignment.section_id)
    .eq("is_active", true)

  const students = (allocations ?? []).map((a: any) => {
    const enr = Array.isArray(a.enrollments) ? a.enrollments[0] : a.enrollments
    const student = Array.isArray(enr?.students) ? enr?.students[0] : enr?.students
    return {
      enrollment_id: a.enrollment_id,
      full_name: student?.full_name ?? "Unknown",
      stu_id: student?.stu_id ?? "—",
    }
  })

  // Which section+term combos are already finalized (locked)
  const { data: finalizations } = await adminClient
    .from("term_finalizations")
    .select("term_id")
    .eq("section_id", assignment.section_id)

  const finalizedTermIds = new Set((finalizations ?? []).map((f) => f.term_id))

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0d2e] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Link
            href="/dashboard/teacher"
            className="text-sm text-gray-500 hover:text-[#6c63ff] transition-colors"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {subject?.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {grade?.name} — {section?.name}
            {stream && ` (${stream.name})`}
          </p>
        </div>

        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-white/10 p-6">
          <GradebookClient
            assignmentId={assignmentId}
            subjectId={assignment.subject_id}
            gradingType={subject?.grading_type ?? "NUMERIC"}
            terms={terms ?? []}
            students={students}
            finalizedTermIds={Array.from(finalizedTermIds)}
          />
        </div>
      </div>
    </main>
  )
}

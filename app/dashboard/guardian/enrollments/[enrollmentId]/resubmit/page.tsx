// app/dashboard/guardian/enrollments/[enrollmentId]/resubmit/page.tsx
// Redesigned resubmission page with modern UI

import { requireRole } from "@/lib/supabase/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import ResubmitEnrollmentClient from "@/components/guardian/resubmit-enrollment-client"

interface ResubmitPageProps {
  params: Promise<{ enrollmentId: string }>
}

export default async function ResubmitEnrollmentPage({
  params,
}: ResubmitPageProps) {
  const user = await requireRole("GUARDIAN")
  const { enrollmentId } = await params

  const adminClient = createAdminClient()

  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(`
      id, status, branch_id, grade_id, stream_id, academic_year_id,
      students!inner (id, full_name),
      academic_years!inner (name)
    `)
    .eq("id", enrollmentId)
    .eq("guardian_id", user.id)
    .single()

  if (!enrollment || enrollment.status !== "REJECTED") {
    redirect(`/dashboard/guardian/enrollments/${enrollmentId}`)
  }

  const student = Array.isArray(enrollment.students)
    ? enrollment.students[0]
    : enrollment.students
  const academicYear = Array.isArray(enrollment.academic_years)
    ? enrollment.academic_years[0]
    : enrollment.academic_years

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f8f7ff] via-white to-[#f0eeff] dark:from-[#0a0a1a] dark:via-[#0d0d1a] dark:to-[#0f0f24] px-4 py-8 md:py-12">
      <div className="mx-auto max-w-3xl">
        {/* Back button */}
        <div className="mb-8">
          <Link 
            href={`/dashboard/guardian/enrollments/${enrollmentId}`}
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-[#6c63ff] dark:hover:text-[#9d97ff] transition-colors group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Enrollment
          </Link>
        </div>

        {/* Main Card */}
        <div className="relative">
          <div className="absolute -inset-1 bg-linear-to-r from-[#6c63ff]/20 via-transparent to-[#6c63ff]/20 rounded-3xl blur-xl opacity-30" />
          
          <div className="relative bg-white/80 dark:bg-[#13132b]/80 backdrop-blur-xl rounded-2xl border border-gray-100/50 dark:border-white/8 shadow-2xl shadow-[#6c63ff]/5 overflow-hidden">
            
            {/* Header */}
            <div className="relative px-6 pt-8 pb-6 border-b border-gray-100/50 dark:border-white/5">
              <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-red-500 via-[#6c63ff] to-red-500" />
              
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-red-500/20 to-red-600/20 flex items-center justify-center shrink-0 border border-red-500/20">
                  <svg className="w-7 h-7 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                    Fix & Resubmit Application
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {student?.full_name}
                    </span>
                    <span className="text-gray-300 dark:text-white/20 text-xs">·</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {academicYear?.name}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-200/50 dark:border-red-800/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-medium text-red-700 dark:text-red-400">Action Required</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <ResubmitEnrollmentClient
                enrollmentId={enrollmentId}
                studentId={student?.id ?? ""}
                branchId={enrollment.branch_id}
                academicYearName={academicYear?.name ?? ""}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
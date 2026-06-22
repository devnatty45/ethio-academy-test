// app/dashboard/guardian/enrollments/[enrollmentId]/upload-documents/page.tsx
// Redesigned upload documents page with modern UI

import { requireRole } from "@/lib/supabase/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import PostConfirmDocumentsClient from "@/components/guardian/post-confirm-documents-client"

interface UploadDocumentsPageProps {
  params: Promise<{ enrollmentId: string }>
}

export default async function UploadDocumentsPage({
  params,
}: UploadDocumentsPageProps) {
  const user = await requireRole("GUARDIAN")
  const { enrollmentId } = await params

  const adminClient = createAdminClient()
  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(`
      id, status, branch_id, student_id,
      students!inner (full_name),
      academic_years!inner (name)
    `)
    .eq("id", enrollmentId)
    .eq("guardian_id", user.id)
    .single()

  if (!enrollment || enrollment.status !== "PENDING_REVIEW") {
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
              <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-emerald-500 via-[#6c63ff] to-emerald-500" />
              
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                      Upload Documents
                    </h1>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Seat Confirmed
                    </span>
                  </div>
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
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <PostConfirmDocumentsClient
                enrollmentId={enrollmentId}
                studentId={enrollment.student_id}
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
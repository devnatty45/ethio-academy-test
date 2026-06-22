// app/dashboard/guardian/enroll/[studentId]/documents/page.tsx
// Redesigned Document upload page with modern UI

import { requireRole } from "@/lib/supabase/session"
import { isGuardianProfileComplete } from "@/lib/utils/guardian"
import { getOpenAcademicYear } from "@/lib/utils/enrollment"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import EnrollmentDocumentsClient from "@/components/guardian/enrollment-documents-client"

interface DocumentsPageProps {
  params: Promise<{ studentId: string }>
  searchParams: Promise<{
    branchId?: string
    gradeId?: string
    streamId?: string
  }>
}

export default async function DocumentsPage({
  params,
  searchParams,
}: DocumentsPageProps) {
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
  const { branchId, gradeId, streamId } = await searchParams

  if (!branchId || !gradeId) {
    redirect(`/dashboard/guardian/enroll/${studentId}`)
  }

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
    .select("id, full_name")
    .eq("id", studentId)
    .single()

  if (!student) {
    redirect("/dashboard/guardian/enroll")
  }

  const [branchRes, gradeRes] = await Promise.all([
    adminClient.from("branches").select("name").eq("id", branchId).single(),
    adminClient.from("grades").select("name").eq("id", gradeId).single(),
  ])

  let streamName: string | null = null
  if (streamId) {
    const { data: stream } = await adminClient
      .from("streams")
      .select("name")
      .eq("id", streamId)
      .single()
    streamName = stream?.name ?? null
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f8f7ff] via-white to-[#f0eeff] dark:from-[#0a0a1a] dark:via-[#0d0d1a] dark:to-[#0f0f24] px-4 py-8 md:py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header with illustration */}
        <div className="relative">
          <div className="absolute -top-4 -right-4 w-20 h-20 bg-[#6c63ff]/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-[#6c63ff]/5 rounded-full blur-3xl" />
          
          <div className="relative flex items-start gap-4 md:gap-6">
            <div className="hidden md:flex items-center justify-center w-14 h-14 rounded-2xl bg-[#6c63ff]/10 border border-[#6c63ff]/20">
              <svg className="w-7 h-7 text-[#6c63ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#6c63ff]/10 text-[#6c63ff] dark:bg-[#6c63ff]/20 dark:text-[#9d97ff] border border-[#6c63ff]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6c63ff] animate-pulse" />
                  Step 3 of 3
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {openYear.name}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
                Documents & <br className="md:hidden" />
                <span className="text-[#6c63ff] dark:text-[#9d97ff]">Submission</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Student info cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/60 dark:bg-white/5 backdrop-blur-sm rounded-xl border border-gray-100/50 dark:border-white/5 px-4 py-3">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Student</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-white mt-0.5 truncate">{student.full_name}</p>
          </div>
          <div className="bg-white/60 dark:bg-white/5 backdrop-blur-sm rounded-xl border border-gray-100/50 dark:border-white/5 px-4 py-3">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Branch</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-white mt-0.5 truncate">{branchRes.data?.name}</p>
          </div>
          <div className="bg-white/60 dark:bg-white/5 backdrop-blur-sm rounded-xl border border-gray-100/50 dark:border-white/5 px-4 py-3">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Grade</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-white mt-0.5 truncate">{gradeRes.data?.name}</p>
          </div>
          <div className="bg-white/60 dark:bg-white/5 backdrop-blur-sm rounded-xl border border-gray-100/50 dark:border-white/5 px-4 py-3">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Stream</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-white mt-0.5 truncate">{streamName || "—"}</p>
          </div>
        </div>

        {/* Progress steps */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center px-4">
            <div className="w-full h-0.5 bg-gray-200 dark:bg-white/10" />
          </div>
          <div className="relative flex justify-between">
            {[
              { label: "Select", emoji: "📚" },
              { label: "Stream", emoji: "🎯" },
              { label: "Documents", emoji: "📄", active: true },
            ].map((step, i) => (
              <div key={step.label} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  i < 2
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                    : "bg-[#6c63ff] text-white shadow-lg shadow-[#6c63ff]/25 ring-4 ring-[#6c63ff]/20"
                }`}>
                  {i < 2 ? "✓" : "3"}
                </div>
                <span className={`mt-2 text-xs font-medium ${
                  i === 2 ? "text-[#6c63ff] dark:text-[#9d97ff]" : "text-gray-500 dark:text-gray-400"
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Main card */}
        <div className="relative">
          <div className="absolute -inset-1 bg-linear-to-r from-[#6c63ff]/20 via-transparent to-[#6c63ff]/20 rounded-3xl blur-xl opacity-30" />
          <div className="relative bg-white/80 dark:bg-[#13132b]/80 backdrop-blur-xl rounded-2xl border border-gray-100/50 dark:border-white/8 shadow-2xl shadow-[#6c63ff]/5 p-6 md:p-8">
            <EnrollmentDocumentsClient
              studentId={studentId}
              studentName={student.full_name}
              branchId={branchId}
              gradeId={gradeId}
              streamId={streamId ?? null}
              openYearId={openYear.id}
              openYearName={openYear.name}
            />
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          Secured by <span className="text-[#6c63ff]">●</span> End-to-end encryption
        </p>
      </div>
    </div>
  )
}
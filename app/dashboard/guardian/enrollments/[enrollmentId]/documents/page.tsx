// app/dashboard/guardian/enrollments/[enrollmentId]/documents/page.tsx
// Redesigned document status page with modern UI

import { requireRole } from "@/lib/supabase/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import DocumentViewer from "@/components/shared/document-viewer"

interface DocumentsStatusPageProps {
  params: Promise<{ enrollmentId: string }>
}

const DOC_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  guardian_photo: { 
    label: "Guardian Photo", 
    icon: "👤", 
    color: "from-blue-500/10 to-blue-500/5" 
  },
  student_photo: { 
    label: "Student Photo", 
    icon: "🧑", 
    color: "from-purple-500/10 to-purple-500/5" 
  },
  national_id_front: { 
    label: "National ID (Front)", 
    icon: "🪪", 
    color: "from-emerald-500/10 to-emerald-500/5" 
  },
  national_id_back: { 
    label: "National ID (Back)", 
    icon: "🪪", 
    color: "from-emerald-500/10 to-emerald-500/5" 
  },
  birth_certificate: { 
    label: "Birth Certificate", 
    icon: "📜", 
    color: "from-amber-500/10 to-amber-500/5" 
  },
  grade_certificate: { 
    label: "Grade Certificate", 
    icon: "🎓", 
    color: "from-rose-500/10 to-rose-500/5" 
  },
  grade_6_exam_cert: { 
    label: "Grade 6 Exam Certificate", 
    icon: "📝", 
    color: "from-indigo-500/10 to-indigo-500/5" 
  },
  grade_8_exam_cert: { 
    label: "Grade 8 Exam Certificate", 
    icon: "📝", 
    color: "from-indigo-500/10 to-indigo-500/5" 
  },
}

const STATUS_CONFIG: Record<string, { 
  bg: string; 
  text: string; 
  border: string; 
  icon: string;
  badgeBg: string;
}> = {
  PENDING: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200/50 dark:border-amber-800/30",
    icon: "text-amber-500",
    badgeBg: "bg-amber-500/20"
  },
  VERIFIED: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200/50 dark:border-emerald-800/30",
    icon: "text-emerald-500",
    badgeBg: "bg-emerald-500/20"
  },
  REJECTED: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200/50 dark:border-red-800/30",
    icon: "text-red-500",
    badgeBg: "bg-red-500/20"
  },
}

export default async function EnrollmentDocumentsStatusPage({
  params,
}: DocumentsStatusPageProps) {
  const user = await requireRole("GUARDIAN")
  const { enrollmentId } = await params

  const adminClient = createAdminClient()

  // Verify ownership
  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(`
      id, status, guardian_id,
      students!inner (full_name),
      academic_years!inner (name)
    `)
    .eq("id", enrollmentId)
    .eq("guardian_id", user.id)
    .single()

  if (!enrollment) {
    redirect("/dashboard/guardian")
  }

  const student = Array.isArray(enrollment.students)
    ? enrollment.students[0]
    : enrollment.students
  const academicYear = Array.isArray(enrollment.academic_years)
    ? enrollment.academic_years[0]
    : enrollment.academic_years

  // Fetch documents for this enrollment
  const { data: documents } = await adminClient
    .from("enrollment_documents")
    .select(`
      id,
      doc_type,
      verification_status,
      rejection_note,
      is_reused_from_enrollment_id,
      uploaded_at,
      predefined_rejection_reasons (reason_text)
    `)
    .eq("enrollment_id", enrollmentId)
    .order("uploaded_at", { ascending: true })

  // Stats
  const totalDocs = documents?.length || 0
  const verifiedDocs = documents?.filter(d => d.verification_status === "VERIFIED").length || 0
  const rejectedDocs = documents?.filter(d => d.verification_status === "REJECTED").length || 0
  const pendingDocs = documents?.filter(d => d.verification_status === "PENDING").length || 0

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
              <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[#6c63ff] via-[#8b83ff] to-[#6c63ff]" />
              
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                      Documents
                    </h1>
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                      · {totalDocs} files
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {student?.full_name} · {academicYear?.name}
                  </p>
                </div>
                
                {/* Quick stats */}
                <div className="flex gap-2">
                  {verifiedDocs > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-800/30">
                      <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{verifiedDocs}</span>
                    </div>
                  )}
                  {pendingDocs > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-200/50 dark:border-amber-800/30">
                      <svg className="w-3 h-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} />
                        <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth={2} />
                        <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth={2} />
                      </svg>
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-400">{pendingDocs}</span>
                    </div>
                  )}
                  {rejectedDocs > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-200/50 dark:border-red-800/30">
                      <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-xs font-medium text-red-700 dark:text-red-400">{rejectedDocs}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              {!documents || documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
                    <svg className="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No documents uploaded yet</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Documents will appear here once uploaded</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {documents.map((doc, index) => {
                    const docConfig = DOC_TYPE_LABELS[doc.doc_type] || { 
                      label: doc.doc_type, 
                      icon: "📄", 
                      color: "from-gray-500/10 to-gray-500/5" 
                    }
                    const status = doc.verification_status as keyof typeof STATUS_CONFIG
                    const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING
                    
                    const rejectionReason = Array.isArray(doc.predefined_rejection_reasons)
                      ? doc.predefined_rejection_reasons[0]?.reason_text
                      : (doc.predefined_rejection_reasons as { reason_text: string } | null)?.reason_text

                    return (
                      <div
                        key={doc.id}
                        className={`group relative rounded-xl border transition-all duration-300 hover:shadow-md overflow-hidden ${
                          status === "REJECTED"
                            ? `${statusConfig.bg} ${statusConfig.border} border`
                            : status === "VERIFIED"
                            ? `${statusConfig.bg} ${statusConfig.border} border`
                            : "bg-white dark:bg-white/3 border-gray-100/50 dark:border-white/8"
                        }`}
                      >
                        {/* Status bar */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                          status === "VERIFIED" ? "bg-emerald-500" :
                          status === "REJECTED" ? "bg-red-500" :
                          "bg-amber-500"
                        }`} />

                        <div className="pl-4 pr-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              {/* Icon */}
                              <div className={`w-10 h-10 rounded-xl bg-linear-to-br ${docConfig.color} flex items-center justify-center shrink-0`}>
                                <span className="text-lg">{docConfig.icon}</span>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-semibold text-gray-800 dark:text-white">
                                    {docConfig.label}
                                  </p>
                                  
                                  {/* Status badge */}
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                                    {status === "VERIFIED" && (
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                    {status === "REJECTED" && (
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    )}
                                    {status === "PENDING" && (
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} />
                                        <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth={2} />
                                        <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth={2} />
                                      </svg>
                                    )}
                                    {status || "PENDING"}
                                  </span>
                                </div>

                                {/* Rejection details */}
                                {status === "REJECTED" && (
                                  <div className="mt-2 space-y-1">
                                    {rejectionReason && (
                                      <p className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                                        <svg className="w-3 h-3 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>Reason: {rejectionReason}</span>
                                      </p>
                                    )}
                                    {doc.rejection_note && (
                                      <p className="text-xs text-red-500/80 dark:text-red-400/80 italic pl-4">
                                        "{doc.rejection_note}"
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Metadata */}
                                <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                    Uploaded {new Date(doc.uploaded_at).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </span>
                                  {doc.is_reused_from_enrollment_id && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                      Reused
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* View button */}
                            <DocumentViewer
                              documentId={doc.id}
                              docType={doc.doc_type}
                              verificationStatus={doc.verification_status}
                              label={docConfig.label}
                              mode="tab"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Action button */}
              <div className="mt-6 pt-6 border-t border-gray-100/50 dark:border-white/5">
                <Button 
                  asChild 
                  className="w-full bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white rounded-xl py-2.5 font-semibold transition-all duration-300 shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40"
                >
                  <Link href={`/dashboard/guardian/enrollments/${enrollmentId}`}>
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      Back to Enrollment Status
                    </span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
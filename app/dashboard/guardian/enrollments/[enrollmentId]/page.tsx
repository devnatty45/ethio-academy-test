// app/dashboard/guardian/enrollments/[enrollmentId]/page.tsx
// Redesigned Enrollment status page with modern UI

import { requireRole } from "@/lib/supabase/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface EnrollmentStatusPageProps {
  params: Promise<{ enrollmentId: string }>
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "Under Review",
  REJECTED: "Not Accepted",
  PAYMENT_PENDING: "Payment Required",
  ENROLLED: "Enrolled ✓",
  WAITLISTED: "Waitlisted",
  WAITLIST_NOTIFIED: "Waitlist — Action Required",
  WAITLIST_EXPIRED: "Waitlist Expired",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  PENDING_REVIEW: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200/50 dark:border-amber-800/30",
    icon: "text-amber-500"
  },
  REJECTED: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200/50 dark:border-red-800/30",
    icon: "text-red-500"
  },
  PAYMENT_PENDING: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200/50 dark:border-blue-800/30",
    icon: "text-blue-500"
  },
  ENROLLED: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200/50 dark:border-emerald-800/30",
    icon: "text-emerald-500"
  },
  WAITLISTED: {
    bg: "bg-gray-50 dark:bg-white/5",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200/50 dark:border-white/10",
    icon: "text-gray-400"
  },
  WAITLIST_NOTIFIED: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200/50 dark:border-amber-800/30",
    icon: "text-amber-500"
  },
  WAITLIST_EXPIRED: {
    bg: "bg-gray-50 dark:bg-white/5",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200/50 dark:border-white/10",
    icon: "text-gray-400"
  },
  EXPIRED: {
    bg: "bg-gray-50 dark:bg-white/5",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200/50 dark:border-white/10",
    icon: "text-gray-400"
  },
  CANCELLED: {
    bg: "bg-gray-50 dark:bg-white/5",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200/50 dark:border-white/10",
    icon: "text-gray-400"
  },
}

// Status icon mapping
const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING_REVIEW: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  REJECTED: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  PAYMENT_PENDING: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  ENROLLED: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  WAITLISTED: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  WAITLIST_NOTIFIED: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  WAITLIST_EXPIRED: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  EXPIRED: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  CANCELLED: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

export default async function EnrollmentStatusPage({
  params,
}: EnrollmentStatusPageProps) {
  const user = await requireRole("GUARDIAN")
  const { enrollmentId } = await params

  const adminClient = createAdminClient()

  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(`
      id,
      status,
      student_category,
      academic_result,
      submitted_at,
      payment_deadline_at,
      waitlisted_at,
      students!inner (full_name, stu_id),
      branches!inner (name),
      grades!inner (name),
      streams (name),
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
  const branch = Array.isArray(enrollment.branches)
    ? enrollment.branches[0]
    : enrollment.branches
  const grade = Array.isArray(enrollment.grades)
    ? enrollment.grades[0]
    : enrollment.grades
  const stream = Array.isArray(enrollment.streams)
    ? enrollment.streams[0]
    : enrollment.streams
  const academicYear = Array.isArray(enrollment.academic_years)
    ? enrollment.academic_years[0]
    : enrollment.academic_years

  const statusColor = STATUS_COLORS[enrollment.status] ?? STATUS_COLORS.PENDING_REVIEW
  const statusIcon = STATUS_ICONS[enrollment.status] ?? STATUS_ICONS.PENDING_REVIEW
  const statusLabel = STATUS_LABELS[enrollment.status] ?? enrollment.status

  // Helper to format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f8f7ff] via-white to-[#f0eeff] dark:from-[#0a0a1a] dark:via-[#0d0d1a] dark:to-[#0f0f24] px-4 py-8 md:py-12">
      <div className="mx-auto max-w-3xl">
        {/* Header with back button */}
        <div className="mb-8">
          <Link 
            href="/dashboard/guardian"
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-[#6c63ff] dark:hover:text-[#9d97ff] transition-colors group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Main Card */}
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-linear-to-r from-[#6c63ff]/20 via-transparent to-[#6c63ff]/20 rounded-3xl blur-xl opacity-30" />
          
          <div className="relative bg-white/80 dark:bg-[#13132b]/80 backdrop-blur-xl rounded-2xl border border-gray-100/50 dark:border-white/8 shadow-2xl shadow-[#6c63ff]/5 overflow-hidden">
            
            {/* Header Section with gradient accent */}
            <div className="relative px-6 pt-8 pb-6 border-b border-gray-100/50 dark:border-white/5">
              <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[#6c63ff] via-[#8b83ff] to-[#6c63ff]" />
              
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                      Enrollment Status
                    </h1>
                    <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      #{enrollmentId.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {student?.full_name}
                    </span>
                    <span className="text-gray-300 dark:text-white/20 text-xs">·</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {academicYear?.name}
                    </span>
                  </div>
                </div>
                
                {/* Status Badge */}
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${statusColor.bg} ${statusColor.border} border`}>
                  <span className={statusColor.icon}>{statusIcon}</span>
                  <span className={`text-sm font-semibold ${statusColor.text}`}>
                    {statusLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-6">
              {/* Application Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-[#6c63ff]/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#6c63ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Branch</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">{branch?.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-[#6c63ff]/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#6c63ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Grade</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">
                        {grade?.name}
                        {stream && <span className="text-gray-400 dark:text-gray-500 font-normal"> · {stream.name}</span>}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-[#6c63ff]/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#6c63ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Category</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">
                        {enrollment.student_category}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-[#6c63ff]/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#6c63ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Submitted</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">
                        {formatDate(enrollment.submitted_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status-specific messages */}
              {enrollment.status === "PENDING_REVIEW" && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50/80 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/20">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Application Under Review</p>
                    <p className="text-xs text-amber-600/80 dark:text-amber-500/80 leading-relaxed mt-0.5">
                      Your application is being reviewed by the branch administrator. 
                      You will be notified via SMS when a decision is made.
                    </p>
                  </div>
                </div>
              )}

              {enrollment.status === "REJECTED" && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">Application Not Accepted</p>
                    <p className="text-xs text-red-600/80 dark:text-red-500/80 leading-relaxed mt-0.5">
                      Unfortunately, your application was not accepted at this time. 
                      You may contact the branch for more information.
                    </p>
                  </div>
                </div>
              )}

              {enrollment.status === "WAITLISTED" && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50/80 dark:bg-white/5 border border-gray-200/50 dark:border-white/10">
                  <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Waitlisted</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-0.5">
                      You are on the waitlist. You will be notified via SMS if a seat becomes available.
                    </p>
                    {enrollment.waitlisted_at && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Waitlisted on {formatDate(enrollment.waitlisted_at)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {enrollment.status === "WAITLIST_NOTIFIED" && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50/80 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/20">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Action Required!</p>
                    <p className="text-xs text-amber-600/80 dark:text-amber-500/80 leading-relaxed mt-0.5">
                      A seat has become available! Please confirm your offer by uploading the required documents.
                    </p>
                  </div>
                </div>
              )}

              {enrollment.status === "PAYMENT_PENDING" && enrollment.payment_deadline_at && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50/80 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/20">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Payment Required</p>
                    <p className="text-xs text-blue-600/80 dark:text-blue-500/80 leading-relaxed mt-0.5">
                      Complete your payment by <strong>{formatDate(enrollment.payment_deadline_at)}</strong> to secure your enrollment.
                    </p>
                  </div>
                </div>
              )}

              {enrollment.status === "ENROLLED" && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/20">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Successfully Enrolled! 🎉</p>
                    <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80 leading-relaxed mt-0.5">
                      Congratulations! {student?.full_name} has been successfully enrolled.
                      You will receive further information via SMS.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button 
                  asChild 
                  className="flex-1 bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white rounded-xl py-2.5 font-semibold transition-all duration-300 shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40"
                >
                  <Link href={`/dashboard/guardian/enrollments/${enrollmentId}/documents`}>
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      View Documents
                    </span>
                  </Link>
                </Button>
                
                <Button 
                  asChild 
                  variant="outline"
                  className="flex-1 rounded-xl border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-[#6c63ff]/40 hover:text-[#6c63ff] dark:hover:text-[#9d97ff] transition-all"
                >
                  <Link href="/dashboard/guardian">
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Dashboard
                    </span>
                  </Link>
                </Button>
              </div>

              {/* Enrollment ID footer */}
              <div className="pt-4 border-t border-gray-100/50 dark:border-white/5">
                <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 font-mono">
                  Enrollment ID: {enrollmentId}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="mt-8 flex justify-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#6c63ff]/60" />
            <span className="text-[10px] text-gray-400 dark:text-gray-500">Secure</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500/60" />
            <span className="text-[10px] text-gray-400 dark:text-gray-500">Encrypted</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500/60" />
            <span className="text-[10px] text-gray-400 dark:text-gray-500">Verified</span>
          </div>
        </div>
      </div>
    </div>
  )
}
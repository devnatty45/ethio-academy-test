// app/dashboard/guardian/enrollments/[enrollmentId]/confirm-waitlist/page.tsx
// Redesigned waitlist confirmation page with modern UI

import { requireRole } from "@/lib/supabase/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import ConfirmWaitlistClient from "@/components/guardian/confirm-waitlist-client"

interface ConfirmWaitlistPageProps {
  params: Promise<{ enrollmentId: string }>
}

export default async function ConfirmWaitlistPage({
  params,
}: ConfirmWaitlistPageProps) {
  const user = await requireRole("GUARDIAN")
  const { enrollmentId } = await params

  const adminClient = createAdminClient()
  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(`
      id, status, waitlist_notify_deadline_at,
      students!inner (full_name),
      grades!inner (name),
      branches!inner (name)
    `)
    .eq("id", enrollmentId)
    .eq("guardian_id", user.id)
    .single()

  if (!enrollment || enrollment.status !== "WAITLIST_NOTIFIED") {
    redirect(`/dashboard/guardian/enrollments/${enrollmentId}`)
  }

  const student = Array.isArray(enrollment.students)
    ? enrollment.students[0]
    : enrollment.students
  const grade = Array.isArray(enrollment.grades)
    ? enrollment.grades[0]
    : enrollment.grades
  const branch = Array.isArray(enrollment.branches)
    ? enrollment.branches[0]
    : enrollment.branches

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
            
            {/* Header with gradient accent */}
            <div className="relative px-6 pt-8 pb-6 border-b border-gray-100/50 dark:border-white/5">
              <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[#6c63ff] via-[#8b83ff] to-[#6c63ff]" />
              
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-amber-500/20 to-amber-600/20 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <svg className="w-7 h-7 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                    Confirm Your Seat
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {student?.full_name}
                    </span>
                    <span className="text-gray-300 dark:text-white/20 text-xs">·</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {branch?.name}
                    </span>
                    <span className="text-gray-300 dark:text-white/20 text-xs">·</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {grade?.name}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <ConfirmWaitlistClient
                enrollmentId={enrollmentId}
                deadline={enrollment.waitlist_notify_deadline_at}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
// components/guardian/guardian-dashboard-client.tsx
// Fetches and displays all enrollment statuses with real-time countdowns
// Client component

"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface RejectedDocument {
  docType: string
  reason: string | null
  note: string | null
}

interface EnrollmentData {
  id: string
  status: string
  studentCategory: string
  academicResult: string
  paymentDeadlineAt: string | null
  waitlistedAt: string | null
  waitlistNotifyDeadlineAt: string | null
  submittedAt: string
  academicYearName: string
  academicYearStatus: string
  branchName: string
  gradeName: string
  streamName: string | null
  rejectedDocuments: RejectedDocument[]
  waitlistPosition: number | null
}

interface StudentData {
  student: {
    id: string
    stu_id: string
    full_name: string
    date_of_birth: string
    gender: string
  }
  linkType: string
  enrollments: EnrollmentData[]
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "Pending Review",
  REJECTED: "Rejected",
  PAYMENT_PENDING: "Payment Required",
  ENROLLED: "Enrolled",
  WAITLISTED: "Waitlisted",
  WAITLIST_NOTIFIED: "Waitlist — Action Required",
  WAITLIST_EXPIRED: "Waitlist Expired",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  TRANSFER_PENDING: "Transfer In Progress",
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  REJECTED:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  PAYMENT_PENDING:
    "bg-[#6c63ff]/10 text-[#6c63ff] dark:bg-[#6c63ff]/20 dark:text-[#9d97ff]",
  ENROLLED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  WAITLISTED:
    "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400",
  WAITLIST_NOTIFIED:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  WAITLIST_EXPIRED:
    "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-500",
  EXPIRED:
    "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-500",
  CANCELLED:
    "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-500",
  TRANSFER_PENDING:
    "bg-[#6c63ff]/10 text-[#6c63ff] dark:bg-[#6c63ff]/20 dark:text-[#9d97ff]",
}

// Status dot color for the left accent stripe
const STATUS_STRIPE: Record<string, string> = {
  PENDING_REVIEW: "border-l-amber-400",
  REJECTED: "border-l-red-400",
  PAYMENT_PENDING: "border-l-[#6c63ff]",
  ENROLLED: "border-l-emerald-400",
  WAITLISTED: "border-l-gray-300 dark:border-l-gray-600",
  WAITLIST_NOTIFIED: "border-l-amber-400",
  WAITLIST_EXPIRED: "border-l-gray-300 dark:border-l-gray-600",
  EXPIRED: "border-l-gray-300 dark:border-l-gray-600",
  CANCELLED: "border-l-gray-300 dark:border-l-gray-600",
  TRANSFER_PENDING: "border-l-[#6c63ff]",
}

function useCountdown(deadline: string | null): string | null {
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  useEffect(() => {
    if (!deadline) return

    function update() {
      const diff = new Date(deadline!).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft("Expired")
        return
      }
      const hours = Math.floor(diff / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [deadline])

  return timeLeft
}

function EnrollmentCard({ enrollment }: { enrollment: EnrollmentData }) {
  const paymentCountdown = useCountdown(
    enrollment.status === "PAYMENT_PENDING" ? enrollment.paymentDeadlineAt : null
  )
  const waitlistCountdown = useCountdown(
    enrollment.status === "WAITLIST_NOTIFIED" ? enrollment.waitlistNotifyDeadlineAt : null
  )

  const stripe = STATUS_STRIPE[enrollment.status] ?? "border-l-gray-300"

  return (
    <div className={`rounded-xl border border-gray-100 dark:border-white/8 bg-white dark:bg-[#13132b] border-l-4 ${stripe} p-5 space-y-4 shadow-sm`}>

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {enrollment.academicYearName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {enrollment.branchName} · {enrollment.gradeName}
            {enrollment.streamName && ` · ${enrollment.streamName}`}
          </p>
          <span className="inline-block text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/8 rounded-full px-2 py-0.5">
            {enrollment.studentCategory} student
          </span>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${STATUS_COLORS[enrollment.status] ?? "bg-gray-100 text-gray-500"}`}>
          {STATUS_LABELS[enrollment.status] ?? enrollment.status}
        </span>
      </div>

      {/* Payment countdown */}
      {enrollment.status === "PAYMENT_PENDING" && paymentCountdown && (
        <div className="rounded-xl border border-[#6c63ff]/20 bg-[#6c63ff]/5 dark:bg-[#6c63ff]/10 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <p className="text-xs font-semibold text-[#6c63ff] dark:text-[#9d97ff]">
              Time remaining: {paymentCountdown}
            </p>
          </div>
          <p className="text-xs text-[#6c63ff]/70 dark:text-[#9d97ff]/70 pl-5">
            Pay before the deadline to secure your enrollment.
          </p>
        </div>
      )}

      {/* Waitlist countdown */}
      {enrollment.status === "WAITLIST_NOTIFIED" && waitlistCountdown && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Respond within: {waitlistCountdown}
            </p>
          </div>
          <p className="text-xs text-amber-600/80 dark:text-amber-500/80 pl-5">
            A seat is available. Confirm now to proceed.
          </p>
        </div>
      )}

      {/* Waitlist position */}
      {enrollment.status === "WAITLISTED" && enrollment.waitlistPosition && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          Waitlist position: <span className="font-semibold text-gray-700 dark:text-gray-300">#{enrollment.waitlistPosition}</span>
        </div>
      )}

      {/* Transfer pending */}
      {enrollment.status === "TRANSFER_PENDING" && (
        <div className="rounded-xl border border-[#6c63ff]/20 bg-[#6c63ff]/5 dark:bg-[#6c63ff]/10 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            <p className="text-xs font-semibold text-[#6c63ff] dark:text-[#9d97ff]">
              Transfer in progress
            </p>
          </div>
          <p className="text-xs text-[#6c63ff]/70 dark:text-[#9d97ff]/70 pl-5">
            Being transferred by school administration. No action needed — you'll be notified when complete.
          </p>
        </div>
      )}

      {/* Rejection details */}
      {enrollment.status === "REJECTED" && enrollment.rejectedDocuments.length > 0 && (
        <div className="rounded-xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400">
            Documents requiring attention:
          </p>
          <div className="space-y-1.5">
            {enrollment.rejectedDocuments.map((doc, i) => (
              <div key={i} className="text-xs text-red-600 dark:text-red-400/80">
                <span className="font-medium">{doc.docType}</span>
                {doc.reason && <span className="text-red-500/80 dark:text-red-500/60"> — {doc.reason}</span>}
                {doc.note && (
                  <span className="block text-xs italic text-red-400 dark:text-red-500/60 mt-0.5">
                    {doc.note}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {enrollment.status !== "TRANSFER_PENDING" && (
        <div className="flex gap-2 pt-1">
          <Button asChild variant="outline" size="sm" className="text-xs border-gray-200 dark:border-white/10 hover:border-[#6c63ff]/40 hover:text-[#6c63ff]">
            <Link href={`/dashboard/guardian/enrollments/${enrollment.id}`}>
              View Details
            </Link>
          </Button>

          {enrollment.status === "PAYMENT_PENDING" && (
            <Button asChild size="sm" className="text-xs bg-[#6c63ff] hover:bg-[#5a52e0] text-white">
              <Link href={`/dashboard/guardian/enrollments/${enrollment.id}/pay`}>
                Pay Now
              </Link>
            </Button>
          )}

          {enrollment.status === "WAITLIST_NOTIFIED" && (
            <Button asChild size="sm" className="text-xs bg-amber-500 hover:bg-amber-600 text-white">
              <Link href={`/dashboard/guardian/enrollments/${enrollment.id}/confirm-waitlist`}>
                Confirm Now
              </Link>
            </Button>
          )}

          {enrollment.status === "REJECTED" && (
            <Button asChild size="sm" className="text-xs bg-red-500 hover:bg-red-600 text-white">
              <Link href={`/dashboard/guardian/enrollments/${enrollment.id}/resubmit`}>
                Fix & Resubmit
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default function GuardianDashboardClient() {
  const [students, setStudents] = useState<StudentData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEnrollments = useCallback(async () => {
    try {
      const response = await fetch("/api/guardian/enrollments")
      if (!response.ok) {
        setError("Could not load enrollment data")
        return
      }
      const data = await response.json()
      setStudents(data.students ?? [])
    } catch {
      setError("Could not load enrollment data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEnrollments()
    const interval = setInterval(fetchEnrollments, 30000)
    return () => clearInterval(interval)
  }, [fetchEnrollments])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-gray-100 dark:border-white/8 bg-white dark:bg-[#13132b] p-6 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5" />
              <div className="space-y-2">
                <div className="h-3 w-32 rounded bg-gray-100 dark:bg-white/5" />
                <div className="h-2.5 w-24 rounded bg-gray-100 dark:bg-white/5" />
              </div>
            </div>
            <div className="h-24 rounded-xl bg-gray-50 dark:bg-white/5" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-6 py-5 flex items-start gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {students.map(({ student, linkType, enrollments }) => (
        <div key={student.id} className="space-y-4">

          {/* Student card header */}
          <div className="rounded-2xl border border-gray-100 dark:border-white/8 bg-white dark:bg-[#13132b] px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-[#6c63ff]/10 dark:bg-[#6c63ff]/20 flex items-center justify-center text-sm font-bold text-[#6c63ff] dark:text-[#9d97ff] shrink-0">
                  {student.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {student.full_name}
                    </p>
                    {linkType === "CO_GUARDIAN" && (
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

              <div className="flex gap-2 shrink-0">
                <Button asChild variant="ghost" size="sm" className="text-xs text-gray-500 hover:text-[#6c63ff] hover:bg-[#6c63ff]/5">
                  <Link href={`/dashboard/guardian/students/${student.id}`}>
                    Profile
                  </Link>
                </Button>
                <Button asChild size="sm" className="text-xs bg-[#6c63ff] hover:bg-[#5a52e0] text-white">
                  <Link href={`/dashboard/guardian/enroll/${student.id}`}>
                    Enroll
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Enrollments */}
          {enrollments.length === 0 ? (
            <div className="ml-4 rounded-xl border border-dashed border-gray-200 dark:border-white/8 bg-gray-50 dark:bg-white/2 px-5 py-5 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No active enrollments.{" "}
                <Link href={`/dashboard/guardian/enroll/${student.id}`} className="text-[#6c63ff] font-medium hover:underline">
                  Start enrollment →
                </Link>
              </p>
            </div>
          ) : (
            <div className="ml-4 space-y-3 border-l-2 border-[#6c63ff]/20 dark:border-[#6c63ff]/15 pl-4">
              {enrollments.map((enrollment) => (
                <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
              ))}
            </div>
          )}

        </div>
      ))}
    </div>
  )
}
// components/admin/branch-review-queue.tsx
// Redesigned branch review queue with modern UI

"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface Grade {
  id: string
  name: string
  level_order: number
}

interface EnrollmentItem {
  id: string
  status: string
  studentCategory: string
  academicResult: string
  submittedAt: string
  student: {
    id: string
    stu_id: string
    full_name: string
    date_of_birth: string
    gender: string
  }
  grade: { id: string; name: string; level_order: number }
  stream: { id: string; name: string } | null
  academicYearName: string
  documentSummary: {
    total: number
    verified: number
    rejected: number
    pending: number
  }
  flags: {
    hasAcademicResultPending: boolean
    hasRejectedDocs: boolean
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  NEW: "New",
  EXISTING: "Existing",
  RETURNING: "Returning",
}

const CATEGORY_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30",
  EXISTING: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200/50 dark:border-green-800/30",
  RETURNING: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30",
}

export default function BranchReviewQueue() {
  const router = useRouter()
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterGradeId, setFilterGradeId] = useState("")
  const [filterCategory, setFilterCategory] = useState("")

  const fetchQueue = useCallback(async () => {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterGradeId) params.set("gradeId", filterGradeId)
      if (filterCategory) params.set("category", filterCategory)

      const response = await fetch(
        `/api/admin/branch/enrollments?${params}`
      )
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not load review queue")
        return
      }

      setEnrollments(data.enrollments ?? [])
      if (data.grades?.length > 0) setGrades(data.grades)
    } catch {
      setError("Could not load review queue")
    } finally {
      setLoading(false)
    }
  }, [filterGradeId, filterCategory])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-32 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
          <div className="flex-1" />
          <div className="h-9 w-24 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
          <div className="h-9 w-24 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
          <div className="h-9 w-20 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-gray-100 dark:border-white/5 p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-5 w-40 rounded bg-gray-200 dark:bg-white/10" />
                <div className="h-3 w-32 rounded bg-gray-200 dark:bg-white/10" />
                <div className="h-3 w-24 rounded bg-gray-200 dark:bg-white/10" />
              </div>
              <div className="h-8 w-20 rounded bg-gray-200 dark:bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
        <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-red-700 dark:text-red-400">Error Loading Queue</p>
          <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Review Queue
          </h3>
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#6c63ff]/10 text-[#6c63ff] border border-[#6c63ff]/20">
            {enrollments.length}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 ml-auto">
          <select
            value={filterGradeId}
            onChange={(e) => setFilterGradeId(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
          >
            <option value="">All Grades</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
          >
            <option value="">All Categories</option>
            <option value="NEW">New</option>
            <option value="EXISTING">Existing</option>
            <option value="RETURNING">Returning</option>
          </select>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchQueue}
            className="rounded-lg text-gray-500 hover:text-[#6c63ff] hover:bg-[#6c63ff]/10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </Button>
        </div>
      </div>

      {enrollments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No applications pending review</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">All caught up! 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {enrollments.map((enrollment) => {
            const docProgress = enrollment.documentSummary.total > 0
              ? Math.round((enrollment.documentSummary.verified / enrollment.documentSummary.total) * 100)
              : 0

            return (
              <div
                key={enrollment.id}
                className="group relative rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-5 transition-all duration-200 hover:shadow-lg hover:border-[#6c63ff]/20"
              >
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Student info */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {enrollment.student.full_name}
                      </p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[enrollment.studentCategory] ?? "bg-muted text-muted-foreground"}`}>
                        {CATEGORY_LABELS[enrollment.studentCategory] ?? enrollment.studentCategory}
                      </span>
                      {enrollment.flags.hasAcademicResultPending && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Result Pending
                        </span>
                      )}
                      {enrollment.flags.hasRejectedDocs && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-800/30">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Has Rejections
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>STU {enrollment.student.stu_id}</span>
                      <span>·</span>
                      <span>{enrollment.grade.name}</span>
                      {enrollment.stream && (
                        <>
                          <span>·</span>
                          <span>{enrollment.stream.name}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{enrollment.academicYearName}</span>
                    </div>

                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Submitted {formatDate(enrollment.submittedAt)}
                    </p>
                  </div>

                  {/* Document progress */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Documents
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              enrollment.documentSummary.rejected > 0
                                ? "bg-linear-to-r from-red-500 to-amber-500"
                                : docProgress === 100
                                ? "bg-linear-to-r from-emerald-500 to-emerald-400"
                                : "bg-linear-to-r from-[#6c63ff] to-[#8b83ff]"
                            }`}
                            style={{ width: `${docProgress}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${
                          enrollment.documentSummary.rejected > 0
                            ? "text-red-600 dark:text-red-400"
                            : docProgress === 100
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-gray-600 dark:text-gray-300"
                        }`}>
                          {enrollment.documentSummary.verified}/{enrollment.documentSummary.total}
                        </span>
                      </div>
                    </div>
                    {enrollment.documentSummary.rejected > 0 && (
                      <p className="text-xs text-red-500">
                        {enrollment.documentSummary.rejected} rejected
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100/50 dark:border-white/5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/dashboard/branch/review/${enrollment.id}`)}
                    className="rounded-lg border-[#6c63ff]/30 text-[#6c63ff] hover:bg-[#6c63ff]/10 hover:border-[#6c63ff] transition-all duration-200"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Review Application
                    </span>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
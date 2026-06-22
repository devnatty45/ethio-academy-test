// components/admin/student-history-client.tsx
// Redesigned student history client with modern UI

"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Student {
  id: string
  stu_id: string
  full_name: string
  date_of_birth: string
  gender: string
  status: string
}

interface Document {
  id: string
  doc_type: string
  verification_status: string
  uploaded_at: string
  rejection_note: string | null
}

interface Transition {
  id: string
  from_status: string
  to_status: string
  actor_role: string
  reason: string
  created_at: string
}

interface EnrollmentHistory {
  id: string
  status: string
  studentCategory: string
  academicResult: string
  submittedAt: string
  paymentDeadlineAt: string | null
  expiredCount: number
  branchName: string
  gradeName: string
  streamName: string | null
  academicYearName: string
  academicYearStart: number
  totalAmount: number | null
  documents: Document[]
  transitions: Transition[]
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  PENDING_REVIEW: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200/50 dark:border-amber-800/30",
    dot: "bg-amber-500"
  },
  PAYMENT_PENDING: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200/50 dark:border-blue-800/30",
    dot: "bg-blue-500"
  },
  ENROLLED: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200/50 dark:border-emerald-800/30",
    dot: "bg-emerald-500"
  },
  REJECTED: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200/50 dark:border-red-800/30",
    dot: "bg-red-500"
  },
  EXPIRED: {
    bg: "bg-gray-50 dark:bg-white/5",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200/50 dark:border-white/10",
    dot: "bg-gray-400"
  },
  CANCELLED: {
    bg: "bg-gray-50 dark:bg-white/5",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200/50 dark:border-white/10",
    dot: "bg-gray-400"
  },
  WAITLISTED: {
    bg: "bg-orange-50 dark:bg-orange-900/20",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200/50 dark:border-orange-800/30",
    dot: "bg-orange-500"
  },
}

const DOC_STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  VERIFIED: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200/50 dark:border-emerald-800/30",
    dot: "bg-emerald-500"
  },
  REJECTED: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200/50 dark:border-red-800/30",
    dot: "bg-red-500"
  },
  PENDING: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200/50 dark:border-amber-800/30",
    dot: "bg-amber-500"
  },
}

const DOC_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  guardian_photo: { label: "Guardian Photo", icon: "👤" },
  student_photo: { label: "Student Photo", icon: "🧑" },
  national_id_front: { label: "National ID (Front)", icon: "🪪" },
  national_id_back: { label: "National ID (Back)", icon: "🪪" },
  birth_certificate: { label: "Birth Certificate", icon: "📜" },
  grade_certificate: { label: "Grade Certificate", icon: "🎓" },
  grade_6_exam_cert: { label: "Grade 6 Exam Cert", icon: "📝" },
  grade_8_exam_cert: { label: "Grade 8 Exam Cert", icon: "📝" },
}

export default function StudentHistoryClient() {
  const [query, setQuery] = useState("")
  const [studentResults, setStudentResults] = useState<Student[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [history, setHistory] = useState<EnrollmentHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const [expandedEnrollmentId, setExpandedEnrollmentId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"documents" | "transitions">("transitions")

  const handleSearch = useCallback(async () => {
    if (query.length < 2) return
    setSearching(true)
    setSearchError(null)
    setStudentResults([])
    setSelectedStudent(null)
    setHistory([])

    try {
      const response = await fetch(
        `/api/master/students/search?q=${encodeURIComponent(query)}`
      )
      const data = await response.json()
      if (!response.ok) {
        setSearchError(data.error ?? "Search failed")
        return
      }
      setStudentResults(data.students ?? [])
      if ((data.students ?? []).length === 0) {
        setSearchError("No students found")
      }
    } catch {
      setSearchError("Search failed")
    } finally {
      setSearching(false)
    }
  }, [query])

  async function loadHistory(student: Student) {
    setSelectedStudent(student)
    setLoadingHistory(true)
    setHistoryError(null)
    setHistory([])
    setExpandedEnrollmentId(null)

    try {
      const response = await fetch(`/api/master/students/${student.id}/history`)
      const data = await response.json()
      if (!response.ok) {
        setHistoryError(data.error ?? "Could not load history")
        return
      }
      setHistory(data.enrollments ?? [])
    } catch {
      setHistoryError("Could not load history")
    } finally {
      setLoadingHistory(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Search section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Search Student</h3>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by student name or STU ID..."
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={searching || query.length < 2}
            className="rounded-lg bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40 transition-all duration-300 disabled:opacity-50"
          >
            {searching ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                </svg>
                Searching...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </span>
            )}
          </Button>
        </div>

        {searchError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-600 dark:text-red-400">{searchError}</p>
          </div>
        )}

        {/* Student results */}
        {studentResults.length > 0 && !selectedStudent && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Found {studentResults.length} student{studentResults.length === 1 ? "" : "s"}
            </p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {studentResults.map((s) => (
                <button
                  key={s.id}
                  onClick={() => loadHistory(s)}
                  className="w-full text-left rounded-xl border border-gray-100/50 dark:border-white/8 p-4 hover:bg-[#6c63ff]/5 hover:border-[#6c63ff]/30 transition-all duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {s.full_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono text-gray-400 dark:text-gray-500">STU {s.stu_id}</span>
                        <span className="text-gray-300 dark:text-white/20">·</span>
                        <span>{s.gender}</span>
                        <span className="text-gray-300 dark:text-white/20">·</span>
                        <span>{new Date(s.date_of_birth).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${
                      s.status === "ACTIVE"
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30"
                        : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-white/10"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.status === "ACTIVE" ? "bg-emerald-500" : "bg-gray-400"}`} />
                      {s.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Student profile + history */}
      {selectedStudent && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-[#6c63ff]/20 to-[#8b83ff]/20 flex items-center justify-center border border-[#6c63ff]/20">
                <span className="text-2xl font-bold text-[#6c63ff]">
                  {selectedStudent.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {selectedStudent.full_name}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-mono text-gray-400 dark:text-gray-500">STU {selectedStudent.stu_id}</span>
                  <span className="text-gray-300 dark:text-white/20">·</span>
                  <span>{selectedStudent.gender}</span>
                  <span className="text-gray-300 dark:text-white/20">·</span>
                  <span>DOB: {new Date(selectedStudent.date_of_birth).toLocaleDateString()}</span>
                  <span className="text-gray-300 dark:text-white/20">·</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    selectedStudent.status === "ACTIVE"
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400"
                  }`}>
                    <span className={`w-1 h-1 rounded-full ${selectedStudent.status === "ACTIVE" ? "bg-emerald-500" : "bg-gray-400"}`} />
                    {selectedStudent.status}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedStudent(null)
                setHistory([])
                setStudentResults([])
                setQuery("")
              }}
              className="rounded-lg border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#6c63ff]/40 hover:text-[#6c63ff]"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </span>
            </Button>
          </div>

          {historyError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
              <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600 dark:text-red-400">{historyError}</p>
            </div>
          )}

          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading enrollment history...</p>
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center py-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
              <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400">No enrollment history found</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">This student has no enrollments</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Enrollment History</h3>
                <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#6c63ff]/10 text-[#6c63ff] border border-[#6c63ff]/20">
                  {history.length}
                </span>
                <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
              </div>

              <div className="space-y-3">
                {history.map((e) => {
                  const statusColor = STATUS_COLORS[e.status] || STATUS_COLORS.PENDING_REVIEW
                  const isExpanded = expandedEnrollmentId === e.id

                  return (
                    <div
                      key={e.id}
                      className={`rounded-xl border border-gray-100/50 dark:border-white/8 transition-all duration-200 ${
                        isExpanded ? "shadow-md" : "hover:shadow-sm"
                      }`}
                    >
                      <button
                        className="w-full text-left px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors rounded-xl"
                        onClick={() => setExpandedEnrollmentId(isExpanded ? null : e.id)}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {e.academicYearName}
                              </p>
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${statusColor.bg} ${statusColor.text} ${statusColor.border} border`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`} />
                                {e.status}
                              </span>
                              {e.academicResult !== "PENDING" && (
                                <span className={`text-[10px] font-medium ${
                                  e.academicResult === "PASSED"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-red-600 dark:text-red-400"
                                }`}>
                                  {e.academicResult}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <span>{e.branchName}</span>
                              <span className="text-gray-300 dark:text-white/20">·</span>
                              <span>{e.gradeName}</span>
                              {e.streamName && (
                                <>
                                  <span className="text-gray-300 dark:text-white/20">·</span>
                                  <span className="text-gray-400 dark:text-gray-500">{e.streamName}</span>
                                </>
                              )}
                              <span className="text-gray-300 dark:text-white/20">·</span>
                              <span>{e.studentCategory}</span>
                            </div>
                            {e.totalAmount && (
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                Fee: {e.totalAmount.toLocaleString()} ETB
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              <p>{new Date(e.submittedAt).toLocaleDateString()}</p>
                              <p className="text-[10px]">
                                {e.documents.length} docs · {e.transitions.length} transitions
                              </p>
                              {e.expiredCount > 0 && (
                                <p className="text-[10px] text-red-500">
                                  ⚠ {e.expiredCount} expiry{e.expiredCount === 1 ? "" : "s"}
                                </p>
                              )}
                            </div>
                            <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="border-t border-gray-100/50 dark:border-white/5">
                          {/* Tabs */}
                          <div className="flex border-b border-gray-100/50 dark:border-white/5 px-4 bg-gray-50/30 dark:bg-white/3">
                            {(["transitions", "documents"] as const).map((tab) => (
                              <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${
                                  activeTab === tab
                                    ? "border-b-2 border-[#6c63ff] text-[#6c63ff] dark:text-[#9d97ff]"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                }`}
                              >
                                {tab} ({tab === "transitions" ? e.transitions.length : e.documents.length})
                              </button>
                            ))}
                          </div>

                          <div className="p-4 space-y-2">
                            {activeTab === "transitions" ? (
                              e.transitions.length === 0 ? (
                                <p className="text-xs text-gray-400 dark:text-gray-500">No transitions recorded</p>
                              ) : (
                                e.transitions.map((t) => (
                                  <div
                                    key={t.id}
                                    className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5"
                                  >
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-gray-500 dark:text-gray-400">{t.from_status}</span>
                                      <span className="text-gray-400 dark:text-gray-500">→</span>
                                      <span className="font-medium text-gray-800 dark:text-white">{t.to_status}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{t.reason}</p>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                                      <span className="bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full">
                                        {t.actor_role}
                                      </span>
                                      <span>·</span>
                                      <span>{new Date(t.created_at).toLocaleString()}</span>
                                    </div>
                                  </div>
                                ))
                              )
                            ) : (
                              e.documents.length === 0 ? (
                                <p className="text-xs text-gray-400 dark:text-gray-500">No documents uploaded</p>
                              ) : (
                                e.documents.map((d) => {
                                  const docConfig = DOC_TYPE_LABELS[d.doc_type] || { label: d.doc_type, icon: "📄" }
                                  const statusColor = DOC_STATUS_COLORS[d.verification_status] || DOC_STATUS_COLORS.PENDING

                                  return (
                                    <div
                                      key={d.id}
                                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-lg">{docConfig.icon}</span>
                                        <span className="text-sm font-medium text-gray-800 dark:text-white">
                                          {docConfig.label}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        {d.rejection_note && (
                                          <span className="text-xs text-red-500 truncate max-w-32">
                                            {d.rejection_note}
                                          </span>
                                        )}
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor.bg} ${statusColor.text} ${statusColor.border} border`}>
                                          <span className={`w-1 h-1 rounded-full ${statusColor.dot}`} />
                                          {d.verification_status}
                                        </span>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                          {new Date(d.uploaded_at).toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
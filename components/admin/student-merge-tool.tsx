// components/admin/student-merge-tool.tsx
// Redesigned student merge tool with modern UI

"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import SensitiveActionModal from "@/components/admin/sensitive-action-modal"

interface StudentResult {
  id: string
  stu_id: string
  full_name: string
  date_of_birth: string
  gender: string
  status: string
}

interface StudentPreview extends StudentResult {
  enrollmentCount: number
  guardianLinkCount: number
}

interface MergePreview {
  studentA: StudentPreview
  studentB: StudentPreview
  suggestedSurvivingId: string
}

export default function StudentMergeTool() {
  const [queryA, setQueryA] = useState("")
  const [queryB, setQueryB] = useState("")
  const [resultsA, setResultsA] = useState<StudentResult[]>([])
  const [resultsB, setResultsB] = useState<StudentResult[]>([])
  const [selectedA, setSelectedA] = useState<StudentResult | null>(null)
  const [selectedB, setSelectedB] = useState<StudentResult | null>(null)
  const [searchingA, setSearchingA] = useState(false)
  const [searchingB, setSearchingB] = useState(false)

  const [preview, setPreview] = useState<MergePreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [survivingId, setSurvivingId] = useState<string>("")
  const [mergeReason, setMergeReason] = useState("")
  const [reasonError, setReasonError] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [merging, setMerging] = useState(false)

  const search = useCallback(
    async (
      query: string,
      setResults: (r: StudentResult[]) => void,
      setSearching: (v: boolean) => void
    ) => {
      if (query.trim().length < 2) {
        setResults([])
        return
      }
      setSearching(true)
      try {
        const response = await fetch(
          `/api/master/students/search?q=${encodeURIComponent(query)}`
        )
        const data = await response.json()
        setResults(data.students ?? [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    },
    []
  )

  async function loadPreview() {
    if (!selectedA || !selectedB) return
    setError(null)
    setLoadingPreview(true)

    try {
      const response = await fetch(
        `/api/master/students/merge?studentA=${selectedA.id}&studentB=${selectedB.id}`
      )
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not load preview")
        return
      }

      setPreview(data)
      setSurvivingId(data.suggestedSurvivingId)
    } catch {
      setError("Could not load preview")
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleMerge() {
    if (!preview || !survivingId) return
    setError(null)
    setReasonError(null)

    if (mergeReason.trim().length < 10) {
      setReasonError("Reason must be at least 10 characters")
      return
    }

    const mergedId =
      survivingId === preview.studentA.id
        ? preview.studentB.id
        : preview.studentA.id

    setMerging(true)

    try {
      const response = await fetch("/api/master/students/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          survivingStudentId: survivingId,
          mergedStudentId: mergedId,
          reason: mergeReason.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Merge failed")
        return
      }

      const survivingStudent =
        survivingId === preview.studentA.id
          ? preview.studentA
          : preview.studentB

      setSuccessMessage(
        `Merge complete. Surviving record: ${survivingStudent.stu_id} — ${survivingStudent.full_name}`
      )
      setPreview(null)
      setSelectedA(null)
      setSelectedB(null)
      setQueryA("")
      setQueryB("")
      setResultsA([])
      setResultsB([])
      setMergeReason("")
      setSurvivingId("")
    } catch {
      setError("Merge failed. Please try again.")
    } finally {
      setMerging(false)
    }
  }

  const survivingStudent = preview
    ? survivingId === preview.studentA.id
      ? preview.studentA
      : preview.studentB
    : null

  const mergedStudent = preview
    ? survivingId === preview.studentA.id
      ? preview.studentB
      : preview.studentA
    : null

  return (
    <div className="space-y-8">
      {/* Messages */}
      {error && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20 animate-in fade-in slide-in-from-top-2 duration-300">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">Error</p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/20 animate-in fade-in slide-in-from-top-2 duration-300">
          <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Success</p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Student selection */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Select Students to Merge</h3>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Student A */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#6c63ff]/10 text-[#6c63ff] text-xs font-bold border border-[#6c63ff]/20">
                A
              </span>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Student A</p>
            </div>

            {selectedA ? (
              <div className="group rounded-xl border-2 border-[#6c63ff]/30 bg-[#6c63ff]/5 p-4 transition-all duration-200 hover:border-[#6c63ff]/50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {selectedA.full_name}
                    </p>
                    <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                      STU {selectedA.stu_id}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(selectedA.date_of_birth).toLocaleDateString()}
                      </span>
                      <span className="text-gray-300 dark:text-white/20">·</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                        {selectedA.gender.toLowerCase()}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedA(null)
                      setPreview(null)
                      setSurvivingId("")
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <Input
                    placeholder="Search by name or STU ID"
                    value={queryA}
                    onChange={(e) => {
                      setQueryA(e.target.value)
                      search(e.target.value, setResultsA, setSearchingA)
                    }}
                    className="pl-9 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                  />
                </div>
                {searchingA && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                    </svg>
                    Searching...
                  </div>
                )}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {resultsA.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedA(s)
                        setResultsA([])
                        setQueryA("")
                        setPreview(null)
                      }}
                      className="w-full text-left rounded-lg border border-gray-100/50 dark:border-white/5 px-3 py-2 hover:bg-[#6c63ff]/5 hover:border-[#6c63ff]/30 transition-all duration-200 space-y-0.5"
                    >
                      <p className="text-sm font-medium text-gray-800 dark:text-white">
                        {s.full_name}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        STU {s.stu_id} · {s.gender}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Student B */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold border border-amber-200/50 dark:border-amber-800/30">
                B
              </span>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Student B</p>
            </div>

            {selectedB ? (
              <div className="group rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4 transition-all duration-200 hover:border-amber-500/50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {selectedB.full_name}
                    </p>
                    <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                      STU {selectedB.stu_id}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(selectedB.date_of_birth).toLocaleDateString()}
                      </span>
                      <span className="text-gray-300 dark:text-white/20">·</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                        {selectedB.gender.toLowerCase()}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedB(null)
                      setPreview(null)
                      setSurvivingId("")
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <Input
                    placeholder="Search by name or STU ID"
                    value={queryB}
                    onChange={(e) => {
                      setQueryB(e.target.value)
                      search(e.target.value, setResultsB, setSearchingB)
                    }}
                    className="pl-9 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                  />
                </div>
                {searchingB && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                    </svg>
                    Searching...
                  </div>
                )}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {resultsB.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedB(s)
                        setResultsB([])
                        setQueryB("")
                        setPreview(null)
                      }}
                      className="w-full text-left rounded-lg border border-gray-100/50 dark:border-white/5 px-3 py-2 hover:bg-[#6c63ff]/5 hover:border-[#6c63ff]/30 transition-all duration-200 space-y-0.5"
                    >
                      <p className="text-sm font-medium text-gray-800 dark:text-white">
                        {s.full_name}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        STU {s.stu_id} · {s.gender}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Load preview button */}
      {selectedA && selectedB && !preview && (
        <Button
          variant="outline"
          onClick={loadPreview}
          disabled={loadingPreview}
          className="w-full md:w-auto rounded-xl border-2 border-[#6c63ff]/30 text-[#6c63ff] hover:bg-[#6c63ff]/10 hover:border-[#6c63ff] transition-all duration-200"
        >
          {loadingPreview ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
              </svg>
              Loading preview...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview Merge
            </span>
          )}
        </Button>
      )}

      {/* Merge preview */}
      {preview && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Merge Preview</h3>
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[preview.studentA, preview.studentB].map((student) => {
              const isSurviving = student.id === survivingId
              return (
                <div
                  key={student.id}
                  className={`rounded-xl border p-5 transition-all duration-200 ${
                    isSurviving
                      ? "border-emerald-200/50 dark:border-emerald-800/30 bg-emerald-50/30 dark:bg-emerald-900/5"
                      : "border-gray-200/50 dark:border-white/5 bg-gray-50/30 dark:bg-white/3"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {student.full_name}
                      </p>
                      <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        STU {student.stu_id}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${
                        isSurviving
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30"
                          : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-white/10"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isSurviving ? "bg-emerald-500" : "bg-gray-400"}`} />
                      {isSurviving ? "Surviving" : "Will be merged"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-0.5">
                      <p className="text-gray-400 dark:text-gray-500">DOB</p>
                      <p className="text-gray-700 dark:text-gray-300">
                        {new Date(student.date_of_birth).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-gray-400 dark:text-gray-500">Gender</p>
                      <p className="text-gray-700 dark:text-gray-300 capitalize">
                        {student.gender.toLowerCase()}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-gray-400 dark:text-gray-500">Enrollments</p>
                      <p className="text-gray-700 dark:text-gray-300 font-medium">
                        {student.enrollmentCount}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-gray-400 dark:text-gray-500">Guardian Links</p>
                      <p className="text-gray-700 dark:text-gray-300 font-medium">
                        {student.guardianLinkCount}
                      </p>
                    </div>
                  </div>

                  {!isSurviving && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSurvivingId(student.id)}
                      className="mt-3 w-full rounded-lg border-[#6c63ff]/30 text-[#6c63ff] hover:bg-[#6c63ff]/10 hover:border-[#6c63ff] transition-all duration-200"
                    >
                      Make this the surviving record
                    </Button>
                  )}
                </div>
              )
            })}
          </div>

          {/* What will happen */}
          <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-amber-50/80 to-amber-50/30 dark:from-amber-900/20 dark:to-amber-900/5 border border-amber-200/50 dark:border-amber-800/30 p-5">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">What will happen:</p>
                  <ul className="mt-2 space-y-1 text-xs text-amber-600/80 dark:text-amber-400/80">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500">•</span>
                      <span>All enrollments from <span className="font-medium">{mergedStudent?.stu_id}</span> → transferred to <span className="font-medium">{survivingStudent?.stu_id}</span></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500">•</span>
                      <span>All documents from <span className="font-medium">{mergedStudent?.stu_id}</span> → transferred to <span className="font-medium">{survivingStudent?.stu_id}</span></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500">•</span>
                      <span>All guardian links from <span className="font-medium">{mergedStudent?.stu_id}</span> → transferred (duplicates deactivated)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500">•</span>
                      <span><span className="font-medium">{mergedStudent?.stu_id}</span> status set to MERGED — <span className="text-red-500 font-medium">cannot be undone</span></span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Reason input */}
          <div className="space-y-2">
            <Label htmlFor="merge-reason" className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Reason for Merge <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Textarea
                id="merge-reason"
                value={mergeReason}
                onChange={(e) => {
                  setMergeReason(e.target.value)
                  setReasonError(null)
                }}
                placeholder="Explain why these student profiles are being merged"
                rows={2}
                maxLength={500}
                className={`rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 resize-none ${
                  reasonError ? "border-red-300 dark:border-red-800 focus:ring-red-500/20" : ""
                }`}
              />
              <p className="text-[10px] text-gray-400 dark:text-gray-500 text-right mt-1">
                {mergeReason.length}/500 characters {mergeReason.length > 0 && mergeReason.length < 10 && `(${10 - mergeReason.length} more needed)`}
              </p>
            </div>
            {reasonError && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {reasonError}
              </p>
            )}
          </div>

          <SensitiveActionModal
            actionDescription={`Merge student ${mergedStudent?.stu_id} into ${survivingStudent?.stu_id} — this cannot be undone`}
            onVerified={handleMerge}
            variant="destructive"
            disabled={merging}
          >
            {merging ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                </svg>
                Merging...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Confirm Merge — Cannot Be Undone
              </span>
            )}
          </SensitiveActionModal>
        </div>
      )}
    </div>
  )
}
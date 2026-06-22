// components/guardian/enrollment-form.tsx
// Enrollment form — branch and grade selection with grade gate
// Shows locked grade message if student FAILED previous year
// Client component

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface AvailabilityItem {
  branchId: string
  branchName: string
  branchCode: string
  gradeId: string
  gradeName: string
  gradeLevelOrder: number
  streamId: string | null
  streamName: string | null
  totalSeats: number
  availableSeats: number
  waitlistCapacity: number
  waitlistCount: number
  isFull: boolean
  waitlistOpen: boolean
  feeAmount: number | null
}

interface EligibilityData {
  alreadyEnrolled: boolean
  category: "NEW" | "EXISTING" | "RETURNING"
  academicResult: "PENDING" | "PASSED" | "FAILED"
  lockedGradeId: string | null
  lockedGradeName: string | null
  mostRecentEnrollment: {
    gradeId: string
    branchId: string
    academicResult: string
  } | null
}

interface EnrollmentFormProps {
  studentId: string
  studentName: string
  openYearId: string
  openYearName: string
}

export default function EnrollmentForm({
  studentId,
  studentName,
  openYearId,
  openYearName,
}: EnrollmentFormProps) {
  const router = useRouter()
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null)
  const [availability, setAvailability] = useState<AvailabilityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedBranchId, setSelectedBranchId] = useState("")
  const [selectedGradeId, setSelectedGradeId] = useState("")
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [eligRes, availRes] = await Promise.all([
          fetch(`/api/enrollment/eligibility/${studentId}`),
          fetch("/api/enrollment/availability"),
        ])

        const [eligData, availData] = await Promise.all([
          eligRes.json(),
          availRes.json(),
        ])

        if (!eligRes.ok) {
          setError(eligData.error ?? "Could not load eligibility data")
          return
        }

        if (!availRes.ok) {
          setError(availData.error ?? "Could not load availability data")
          return
        }

        setEligibility(eligData)
        setAvailability(availData.availability ?? [])

        if (eligData.academicResult === "FAILED" && eligData.lockedGradeId) {
          setSelectedGradeId(eligData.lockedGradeId)
          if (eligData.mostRecentEnrollment?.branchId) {
            setSelectedBranchId(eligData.mostRecentEnrollment.branchId)
          }
        }
      } catch {
        setError("Could not load enrollment data")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [studentId])

  const branches = Array.from(
    new Map(
      availability.map((a) => [
        a.branchId,
        { id: a.branchId, name: a.branchName, code: a.branchCode },
      ])
    ).values()
  )

  const gradesForBranch = availability.filter(
    (a) => a.branchId === selectedBranchId && a.streamId === null
  )

  const streamGradeIds = new Set(
    availability
      .filter((a) => a.branchId === selectedBranchId && a.streamId !== null)
      .map((a) => a.gradeId)
  )

  const allGradesForBranch = [
    ...gradesForBranch,
    ...availability
      .filter(
        (a) =>
          a.branchId === selectedBranchId &&
          a.streamId !== null &&
          !gradesForBranch.find((g) => g.gradeId === a.gradeId)
      )
      .filter((a, i, arr) => arr.findIndex((b) => b.gradeId === a.gradeId) === i),
  ].sort((a, b) => a.gradeLevelOrder - b.gradeLevelOrder)

  const streamsForGrade = availability.filter(
    (a) =>
      a.branchId === selectedBranchId &&
      a.gradeId === selectedGradeId &&
      a.streamId !== null
  )

  const selectedAvailability = availability.find(
    (a) =>
      a.branchId === selectedBranchId &&
      a.gradeId === selectedGradeId &&
      (streamsForGrade.length > 0
        ? a.streamId === selectedStreamId
        : a.streamId === null)
  )

  const isFailed = eligibility?.academicResult === "FAILED"
  const lockedGradeId = eligibility?.lockedGradeId

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 rounded-xl bg-gray-100 dark:bg-white/5 w-1/3" />
        <div className="h-14 rounded-xl bg-gray-100 dark:bg-white/5" />
        <div className="h-14 rounded-xl bg-gray-100 dark:bg-white/5" />
        <div className="h-14 rounded-xl bg-gray-100 dark:bg-white/5" />
      </div>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  if (!eligibility) return null

  return (
    <div className="space-y-6">

      {/* Student category + result badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400">
          {eligibility.category} student
        </span>
        {eligibility.academicResult !== "PENDING" && (
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${
              eligibility.academicResult === "PASSED"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            Previous year: {eligibility.academicResult}
          </span>
        )}
      </div>

      {/* FAILED grade gate warning */}
      {isFailed && lockedGradeId && (
        <div className="flex items-start gap-3 rounded-xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              Grade selection restricted
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
              Based on {studentName}&apos;s academic record, they may only enroll in{" "}
              <span className="font-semibold">{eligibility.lockedGradeName}</span>{" "}
              for this academic year.
            </p>
          </div>
        </div>
      )}

      {/* ── Branch selection ── */}
      <div className="space-y-2.5">
        <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Branch
        </Label>
        <div className="space-y-2">
          {branches.map((branch) => {
            const isLocked =
              isFailed &&
              eligibility.mostRecentEnrollment?.branchId !== branch.id

            const isSelected = selectedBranchId === branch.id

            return (
              <button
                key={branch.id}
                type="button"
                disabled={isLocked}
                onClick={() => {
                  setSelectedBranchId(branch.id)
                  setSelectedGradeId("")
                  setSelectedStreamId(null)
                }}
                className={`w-full text-left rounded-xl border px-4 py-3.5 text-sm font-medium transition-all ${
                  isSelected
                    ? "bg-[#6c63ff] text-white border-[#6c63ff] shadow-sm"
                    : isLocked
                    ? "opacity-40 cursor-not-allowed border-gray-100 dark:border-white/8 bg-gray-50 dark:bg-white/3 text-gray-500 dark:text-gray-400"
                    : "border-gray-100 dark:border-white/8 bg-gray-50 dark:bg-white/3 text-gray-700 dark:text-gray-300 hover:border-[#6c63ff]/40 hover:bg-[#6c63ff]/5"
                }`}
              >
                {branch.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Grade selection ── */}
      {selectedBranchId && (
        <div className="space-y-2.5">
          <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Grade
          </Label>
          {allGradesForBranch.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No grades available for this branch.
            </p>
          ) : (
            <div className="space-y-2">
              {allGradesForBranch.map((item) => {
                const isLockedGrade =
                  isFailed && lockedGradeId && item.gradeId !== lockedGradeId

                const displayItem =
                  item.streamId !== null
                    ? availability.find(
                        (a) =>
                          a.branchId === selectedBranchId &&
                          a.gradeId === item.gradeId &&
                          a.streamId !== null
                      ) ?? item
                    : item

                const isSelected = selectedGradeId === item.gradeId

                return (
                  <button
                    key={item.gradeId}
                    type="button"
                    disabled={!!isLockedGrade}
                    onClick={() => {
                      setSelectedGradeId(item.gradeId)
                      setSelectedStreamId(null)
                    }}
                    className={`w-full text-left rounded-xl border px-4 py-3.5 text-sm font-medium transition-all ${
                      isSelected
                        ? "bg-[#6c63ff] text-white border-[#6c63ff] shadow-sm"
                        : isLockedGrade
                        ? "opacity-40 cursor-not-allowed border-gray-100 dark:border-white/8 bg-gray-50 dark:bg-white/3 text-gray-500 dark:text-gray-400"
                        : "border-gray-100 dark:border-white/8 bg-gray-50 dark:bg-white/3 text-gray-700 dark:text-gray-300 hover:border-[#6c63ff]/40 hover:bg-[#6c63ff]/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>{item.gradeName}</span>
                      <div className="text-right space-y-0.5 shrink-0">
                        {item.streamId === null && (
                          <>
                            <p className={`text-xs font-medium ${isSelected ? "text-white/70" : displayItem.isFull ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500"}`}>
                              {displayItem.availableSeats}/{displayItem.totalSeats} seats
                            </p>
                            {displayItem.isFull && (
                              <p className={`text-xs ${isSelected ? "text-white/60" : "text-gray-400 dark:text-gray-500"}`}>
                                {displayItem.waitlistOpen
                                  ? `Waitlist: ${displayItem.waitlistCount}/${displayItem.waitlistCapacity}`
                                  : "Full — waitlist closed"}
                              </p>
                            )}
                          </>
                        )}
                        {item.streamId !== null && (
                          <p className={`text-xs ${isSelected ? "text-white/70" : "text-gray-400 dark:text-gray-500"}`}>
                            Select stream below
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Stream selection ── */}
      {selectedGradeId && streamsForGrade.length > 0 && (
        <div className="space-y-2.5">
          <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Stream
          </Label>
          <div className="space-y-2">
            {streamsForGrade.map((item) => {
              const isSelected = selectedStreamId === item.streamId
              return (
                <button
                  key={item.streamId}
                  type="button"
                  onClick={() => setSelectedStreamId(item.streamId)}
                  className={`w-full text-left rounded-xl border px-4 py-3.5 text-sm font-medium transition-all ${
                    isSelected
                      ? "bg-[#6c63ff] text-white border-[#6c63ff] shadow-sm"
                      : "border-gray-100 dark:border-white/8 bg-gray-50 dark:bg-white/3 text-gray-700 dark:text-gray-300 hover:border-[#6c63ff]/40 hover:bg-[#6c63ff]/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>{item.streamName}</span>
                    <div className="text-right space-y-0.5 shrink-0">
                      <p className={`text-xs font-medium ${isSelected ? "text-white/70" : item.isFull ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500"}`}>
                        {item.availableSeats}/{item.totalSeats} seats
                      </p>
                      {item.isFull && (
                        <p className={`text-xs ${isSelected ? "text-white/60" : "text-gray-400 dark:text-gray-500"}`}>
                          {item.waitlistOpen
                            ? `Waitlist: ${item.waitlistCount}/${item.waitlistCapacity}`
                            : "Full — waitlist closed"}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Fee display ── */}
      {selectedAvailability?.feeAmount && (
        <div className="rounded-xl border border-[#6c63ff]/20 bg-[#6c63ff]/5 dark:bg-[#6c63ff]/10 px-4 py-3.5 flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <div>
            <p className="text-sm font-semibold text-[#6c63ff] dark:text-[#9d97ff]">
              Enrollment fee:{" "}
              <span className="text-gray-900 dark:text-white">
                {selectedAvailability.feeAmount.toLocaleString()} ETB
              </span>
            </p>
            <p className="text-xs text-[#6c63ff]/70 dark:text-[#9d97ff]/70 mt-0.5">
              Payment will be required after admin approval.
            </p>
          </div>
        </div>
      )}

      {/* ── Full / waitlist warning ── */}
      {selectedAvailability?.isFull && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${
          selectedAvailability.waitlistOpen
            ? "border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10"
            : "border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10"
        }`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={selectedAvailability.waitlistOpen ? "#d97706" : "#ef4444"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          {selectedAvailability.waitlistOpen ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              This grade is full. Your application will be added to the waitlist — position{" "}
              <span className="font-semibold">{selectedAvailability.waitlistCount + 1}</span> of{" "}
              {selectedAvailability.waitlistCapacity}.
            </p>
          ) : (
            <p className="text-sm text-red-600 dark:text-red-400">
              This grade is full and the waitlist is also closed. No more applications can be accepted.
            </p>
          )}
        </div>
      )}

      {/* ── Continue button ── */}
      <Button
        className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white rounded-xl py-2.5 font-semibold transition-all disabled:opacity-50"
        disabled={
          !selectedBranchId ||
          !selectedGradeId ||
          (streamsForGrade.length > 0 && !selectedStreamId) ||
          (selectedAvailability?.isFull && !selectedAvailability?.waitlistOpen)
        }
        onClick={() => {
          const params = new URLSearchParams({
            branchId: selectedBranchId,
            gradeId: selectedGradeId,
            ...(selectedStreamId && { streamId: selectedStreamId }),
          })
          router.push(`/dashboard/guardian/enroll/${studentId}/documents?${params}`)
        }}
      >
        Continue to Documents →
      </Button>

    </div>
  )
}
// components/guardian/claim-student-flow.tsx
// Redesigned claim student flow with modern UI

"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

interface StudentMatch {
  id: string
  stu_id: string
  full_name: string
  date_of_birth: string
  gender: string
  overall_score: number
  confidence: string
}

interface ClaimStudentFlowProps {
  matchId: string
}

export default function ClaimStudentFlow({
  matchId,
}: ClaimStudentFlowProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [student, setStudent] = useState<StudentMatch | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem(`match_${matchId}`)
    if (stored) {
      try {
        setStudent(JSON.parse(stored))
      } catch {
        router.push("/dashboard/guardian/add-student")
      }
    } else {
      router.push("/dashboard/guardian/add-student")
    }
    setLoading(false)
  }, [matchId, router])

  async function handleSubmitClaim() {
    if (!student) return
    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch("/api/guardian/students/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchedStudentId: student.id,
          submittedName: student.full_name,
          submittedDob: student.date_of_birth,
          submittedGender: student.gender,
          confidenceScore: student.overall_score,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.blocked) {
          setBlocked(true)
          setError(data.error)
          return
        }
        setError(data.error ?? "Could not submit claim. Please try again.")
        return
      }

      setSubmitted(true)
      sessionStorage.removeItem(`match_${matchId}`)
    } catch {
      setError("Could not submit claim. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Loading student record...
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-50/80 to-emerald-50/30 dark:from-emerald-900/20 dark:to-emerald-900/5 border border-emerald-200/50 dark:border-emerald-800/30 p-8 text-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
          
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mb-2">
              Claim Submitted! ✓
            </h3>
            <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 leading-relaxed">
              An administrator will review your request. You will be notified once a decision is made.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full rounded-xl border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-[#6c63ff]/40 hover:text-[#6c63ff] dark:hover:text-[#9d97ff] transition-all"
          onClick={() => router.push("/dashboard/guardian")}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Return to Dashboard
          </span>
        </Button>
      </div>
    )
  }

  if (blocked) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-red-50/80 to-red-50/30 dark:from-red-900/20 dark:to-red-900/5 border border-red-200/50 dark:border-red-800/30 p-6">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />
          
          <div className="relative flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-700 dark:text-red-400">
                Claim Blocked
              </h3>
              <p className="text-sm text-red-600/80 dark:text-red-400/80 leading-relaxed mt-1">
                {error || "This student record cannot be claimed at this time."}
              </p>
              <p className="text-xs text-red-500/60 dark:text-red-400/60 mt-2">
                Please contact the school administration for assistance.
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full rounded-xl border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-[#6c63ff]/40 hover:text-[#6c63ff] dark:hover:text-[#9d97ff] transition-all"
          onClick={() => router.push("/dashboard/guardian")}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Return to Dashboard
          </span>
        </Button>
      </div>
    )
  }

  if (!student) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Student Details Card */}
      <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-[#6c63ff]/5 to-[#8b83ff]/5 border border-[#6c63ff]/20 p-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#6c63ff]/5 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#8b83ff]/5 rounded-full blur-2xl" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#6c63ff]/10 flex items-center justify-center border border-[#6c63ff]/20">
              <span className="text-xl font-bold text-[#6c63ff]">
                {student.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {student.full_name}
              </h3>
              <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                STU {student.stu_id}
              </p>
            </div>
            <div className="ml-auto">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                student.confidence === "HIGH"
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30"
                  : student.confidence === "MEDIUM"
                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30"
                  : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border border-gray-200/50 dark:border-white/10"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  student.confidence === "HIGH" ? "bg-emerald-500" :
                  student.confidence === "MEDIUM" ? "bg-amber-500" :
                  "bg-gray-500"
                }`} />
                {student.confidence} Match
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-white/50 dark:bg-white/5">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Date of Birth</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white">
                  {new Date(student.date_of_birth).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-white/50 dark:bg-white/5">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Gender</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white capitalize">
                  {student.gender.toLowerCase()}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-white/50 dark:bg-white/5">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">Match Confidence</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white">
                {(student.overall_score * 100).toFixed(0)}% match
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && !blocked && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/20">
        <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Before You Submit</p>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed mt-1">
            By submitting this claim, you confirm that this student is your child. 
            An administrator will verify your claim before linking this record to your account.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 rounded-xl border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-[#6c63ff]/40 hover:text-[#6c63ff] dark:hover:text-[#9d97ff] transition-all"
          onClick={() => router.push("/dashboard/guardian/add-student")}
          disabled={submitting}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Go Back
          </span>
        </Button>
        <Button
          className="flex-1 bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white rounded-xl py-2.5 font-semibold transition-all duration-300 shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40 disabled:opacity-50"
          onClick={handleSubmitClaim}
          disabled={submitting}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
              </svg>
              Submitting...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Submit Claim
            </span>
          )}
        </Button>
      </div>

      {/* Status indicators */}
      <div className="flex justify-center gap-6 pt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Pending Review</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6c63ff]" />
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Verification Required</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Admin Review</span>
        </div>
      </div>
    </div>
  )
}
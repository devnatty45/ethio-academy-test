// components/guardian/add-student-flow.tsx
// Multi-step add student flow:
// Step 1: Enter details
// Step 2: Review fuzzy matches
// Step 3: Confirm creation (if no match) or handle match case
// Client component

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type FlowStep = "form" | "matches" | "creating" | "done"

interface FuzzyMatch {
  id: string
  stu_id: string
  full_name: string
  date_of_birth: string
  gender: string
  name_similarity: number
  dob_matches: boolean
  overall_score: number
  confidence: "HIGH" | "MEDIUM" | "LOW"
}

interface SearchResult {
  matches: FuzzyMatch[]
  submittedName: string
  submittedDob: string
  submittedGender: string
}

const CONFIDENCE_BORDER: Record<string, string> = {
  HIGH: "border-l-red-400",
  MEDIUM: "border-l-amber-400",
  LOW: "border-l-gray-300 dark:border-l-gray-600",
}

const CONFIDENCE_BG: Record<string, string> = {
  HIGH: "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20",
  MEDIUM: "bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20",
  LOW: "bg-gray-50 dark:bg-white/3 border-gray-100 dark:border-white/8",
}

const CONFIDENCE_BADGE: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  LOW: "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
}

const CONFIDENCE_LABELS = {
  HIGH: "Strong match",
  MEDIUM: "Possible match",
  LOW: "Weak match",
}

export default function AddStudentFlow() {
  const router = useRouter()
  const [step, setStep] = useState<FlowStep>("form")
  const [fullName, setFullName] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "">("")
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!gender) {
      setError("Please select gender")
      return
    }

    setSearching(true)

    try {
      const response = await fetch("/api/guardian/students/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, dateOfBirth, gender }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Search failed. Please try again.")
        return
      }

      setSearchResult(data)
      setStep("matches")
    } catch {
      setError("Search failed. Please try again.")
    } finally {
      setSearching(false)
    }
  }

  async function handleCreateNew() {
    setError(null)
    setCreating(true)

    try {
      const response = await fetch("/api/guardian/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: searchResult?.submittedName ?? fullName,
          dateOfBirth: searchResult?.submittedDob ?? dateOfBirth,
          gender: searchResult?.submittedGender ?? gender,
          confirmedNoMatch: true,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.match) {
          setError(
            `A very similar student (${data.match.stuId}) was found. Please review before creating.`
          )
          return
        }
        setError(data.error ?? "Could not create student. Please try again.")
        return
      }

      setStep("done")
      setTimeout(() => {
        router.push("/dashboard/guardian")
        router.refresh()
      }, 1500)
    } catch {
      setError("Could not create student. Please try again.")
    } finally {
      setCreating(false)
    }
  }

  function handleMatchSelected(match: FuzzyMatch) {
    sessionStorage.setItem(`match_${match.id}`, JSON.stringify(match))
    router.push(`/dashboard/guardian/claim-student?matchId=${match.id}`)
  }

  // ── Step 1: Form ──
  if (step === "form") {
    return (
      <form onSubmit={handleSearch} className="space-y-6">
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="student-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Student Full Name
          </Label>
          <Input
            id="student-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter student's full legal name"
            required
            minLength={2}
            maxLength={100}
            className="rounded-xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 placeholder:text-gray-400"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="student-dob" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Date of Birth
          </Label>
          <Input
            id="student-dob"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            required
            max={new Date().toISOString().split("T")[0]}
            className="rounded-xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Gender
          </Label>
          <div className="flex gap-3">
            {(["MALE", "FEMALE"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  gender === g
                    ? "bg-[#6c63ff] text-white border-[#6c63ff] shadow-sm"
                    : "bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-[#6c63ff]/40 hover:text-[#6c63ff]"
                }`}
              >
                {g === "MALE" ? "Male" : "Female"}
              </button>
            ))}
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white rounded-xl py-2.5 font-semibold transition-all"
          disabled={searching || !fullName || !dateOfBirth || !gender}
        >
          {searching ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10"/></svg>
              Searching records...
            </span>
          ) : (
            "Check for Existing Record"
          )}
        </Button>
      </form>
    )
  }

  // ── Step 2: Matches ──
  if (step === "matches" && searchResult) {
    const { matches, submittedName, submittedDob } = searchResult
    const hasHighConfidence = matches.some((m) => m.confidence === "HIGH")

    return (
      <div className="space-y-5">

        {/* Search summary */}
        <div className="rounded-xl border border-[#6c63ff]/20 bg-[#6c63ff]/5 dark:bg-[#6c63ff]/10 px-4 py-3 flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <div>
            <p className="text-sm font-semibold text-[#6c63ff] dark:text-[#9d97ff]">
              {submittedName}
            </p>
            <p className="text-xs text-[#6c63ff]/70 dark:text-[#9d97ff]/70 mt-0.5">
              Date of birth: {submittedDob}
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* No matches */}
        {matches.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/3 px-5 py-8 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                No existing records found
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                A new student profile will be created with the details you provided.
              </p>
            </div>
            <Button
              className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white rounded-xl font-semibold"
              onClick={handleCreateNew}
              disabled={creating}
            >
              {creating ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10"/></svg>
                  Creating profile...
                </span>
              ) : (
                "Create New Student Profile"
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-xl border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#6c63ff]/40 hover:text-[#6c63ff]"
              onClick={() => setStep("form")}
              disabled={creating}
            >
              ← Go Back and Edit Details
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold text-gray-900 dark:text-white">{matches.length} potential match{matches.length === 1 ? "" : "es"}</span> found. Review carefully before continuing:
            </p>

            <div className="space-y-3">
              {matches.map((match) => (
                <div
                  key={match.id}
                  className={`rounded-xl border border-l-4 ${CONFIDENCE_BORDER[match.confidence]} ${CONFIDENCE_BG[match.confidence]} p-4 space-y-3`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {match.full_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        STU ID: <span className="font-medium text-gray-700 dark:text-gray-300">{match.stu_id}</span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        DOB: {new Date(match.date_of_birth).toLocaleDateString()}
                        {match.dob_matches && (
                          <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-medium">· DOB matches</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Gender: {match.gender}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${CONFIDENCE_BADGE[match.confidence]}`}>
                        {CONFIDENCE_LABELS[match.confidence]}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {Math.round(match.overall_score * 100)}% match
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-lg border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-[#6c63ff]/50 hover:text-[#6c63ff] font-medium"
                    onClick={() => handleMatchSelected(match)}
                  >
                    This is my child →
                  </Button>
                </div>
              ))}
            </div>

            {!hasHighConfidence && (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                  None of these are your child?
                </p>
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#6c63ff]/40 hover:text-[#6c63ff]"
                  onClick={handleCreateNew}
                  disabled={creating}
                >
                  {creating ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10"/></svg>
                      Creating...
                    </span>
                  ) : (
                    "None of these — create new profile"
                  )}
                </Button>
              </div>
            )}

            {hasHighConfidence && (
              <div className="flex items-start gap-3 rounded-xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <p className="text-xs text-red-600 dark:text-red-400">
                  A strong match was found. Please select the matching record or contact the school if you believe this is an error.
                </p>
              </div>
            )}

            <Button
              variant="ghost"
              className="w-full text-gray-500 dark:text-gray-400 hover:text-[#6c63ff] hover:bg-[#6c63ff]/5 rounded-xl"
              onClick={() => {
                setStep("form")
                setSearchResult(null)
              }}
            >
              ← Go Back and Edit Details
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ── Done ──
  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div>
          <p className="text-base font-bold text-gray-900 dark:text-white">
            Student profile created
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Redirecting to your dashboard...
          </p>
        </div>
      </div>
    )
  }

  return null
}
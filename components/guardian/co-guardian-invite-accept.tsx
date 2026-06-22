// components/guardian/co-guardian-invite-accept.tsx
// Redesigned co-guardian invitation acceptance UI

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface InviteDetails {
  studentName: string
  stuId: string
  primaryGuardianName: string
  expiresAt: string
}

interface CoGuardianInviteAcceptProps {
  token: string
}

export default function CoGuardianInviteAccept({
  token,
}: CoGuardianInviteAcceptProps) {
  const router = useRouter()
  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  useEffect(() => {
    async function fetchInvite() {
      try {
        const response = await fetch(
          `/api/invite/co-guardian/accept?token=${token}`
        )
        const data = await response.json()

        if (!response.ok) {
          setError(data.error ?? "Invitation not found")
          return
        }

        setInvite(data)
        
        // Calculate time remaining
        if (data.expiresAt) {
          const expiry = new Date(data.expiresAt).getTime()
          const now = Date.now()
          const diff = expiry - now
          if (diff > 0) {
            const hours = Math.floor(diff / 3600000)
            const minutes = Math.floor((diff % 3600000) / 60000)
            setTimeLeft(`${hours}h ${minutes}m`)
          } else {
            setTimeLeft("Expired")
          }
        }
      } catch {
        setError("Could not load invitation details")
      } finally {
        setLoading(false)
      }
    }
    fetchInvite()
  }, [token])

  async function handleAccept() {
    setError(null)
    setAccepting(true)

    try {
      const response = await fetch("/api/invite/co-guardian/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not accept invitation")
        return
      }

      setAccepted(true)
      setTimeout(() => {
        router.push("/dashboard/guardian")
        router.refresh()
      }, 2000)
    } catch {
      setError("Could not accept invitation. Please try again.")
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          Loading invitation details...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-red-50/80 to-red-50/30 dark:from-red-900/20 dark:to-red-900/5 border border-red-200/50 dark:border-red-800/30 p-6 text-center">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />
          
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">
              Invitation Error
            </h3>
            <p className="text-sm text-red-600/80 dark:text-red-400/80">{error}</p>
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
            Go to Dashboard
          </span>
        </Button>
      </div>
    )
  }

  if (accepted) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-emerald-50/80 to-emerald-50/30 dark:from-emerald-900/20 dark:to-emerald-900/5 border border-emerald-200/50 dark:border-emerald-800/30 p-8 text-center">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
        
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mb-2">
            Invitation Accepted! ✓
          </h3>
          <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 leading-relaxed">
            You are now a co-guardian for {invite?.studentName}.
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
            </svg>
            <span className="text-xs text-emerald-600/60 dark:text-emerald-400/60">Redirecting to dashboard...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!invite) return null

  const isExpired = timeLeft === "Expired"

  return (
    <div className="space-y-6">
      {/* Invitation Details Card */}
      <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-[#6c63ff]/5 to-[#8b83ff]/5 border border-[#6c63ff]/20 p-6">
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#6c63ff]/5 rounded-full blur-2xl" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#6c63ff]/10 flex items-center justify-center border border-[#6c63ff]/20">
              <svg className="w-6 h-6 text-[#6c63ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Invitation Details
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Review the details below before accepting
              </p>
            </div>
            {!isExpired && timeLeft && (
              <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200/50 dark:border-amber-800/30">
                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">{timeLeft}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-white/5">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="text-xs text-gray-500 dark:text-gray-400">Student</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {invite.studentName}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-white/5">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
                <span className="text-xs text-gray-500 dark:text-gray-400">STU ID</span>
              </div>
              <span className="text-sm font-mono text-gray-900 dark:text-white">
                {invite.stuId}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-white/5">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-xs text-gray-500 dark:text-gray-400">Invited by</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {invite.primaryGuardianName}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-white/5">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs text-gray-500 dark:text-gray-400">Expires</span>
              </div>
              <span className={`text-sm font-semibold ${isExpired ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                {new Date(invite.expiresAt).toLocaleString()}
              </span>
            </div>
          </div>

          {isExpired && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-50/50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-red-600 dark:text-red-400">This invitation has expired</p>
            </div>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/20">
        <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Co-Guardian Access</p>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed mt-0.5">
            As co-guardian you can view and manage enrollments for this student. 
            The primary guardian can revoke your access at any time.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          className="w-full bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white rounded-xl py-3 font-semibold transition-all duration-300 shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40 disabled:opacity-50 disabled:hover:shadow-lg"
          onClick={handleAccept}
          disabled={accepting || isExpired}
        >
          {accepting ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
              </svg>
              Accepting...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Accept Invitation
            </span>
          )}
        </Button>

        <Button
          variant="outline"
          className="w-full rounded-xl border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-red-500/40 hover:text-red-500 dark:hover:text-red-400 transition-all"
          onClick={() => router.push("/dashboard/guardian")}
          disabled={accepting}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Decline
          </span>
        </Button>
      </div>

      {/* Security badges */}
      <div className="flex justify-center gap-4 pt-2">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Secure</span>
        </div>
        <div className="w-px h-3 bg-gray-200 dark:bg-white/10" />
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Verified</span>
        </div>
      </div>
    </div>
  )
}
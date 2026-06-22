// components/guardian/confirm-waitlist-client.tsx
// Redesigned waitlist confirmation client with modern UI

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface ConfirmWaitlistClientProps {
  enrollmentId: string
  deadline: string | null
}

export default function ConfirmWaitlistClient({
  enrollmentId,
  deadline,
}: ConfirmWaitlistClientProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<string | null>(null)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (!deadline) return
    
    function update() {
      const now = Date.now()
      const deadlineTime = new Date(deadline!).getTime()
      const diff = deadlineTime - now
      
      if (diff <= 0) {
        setTimeLeft("Expired")
        setProgress(0)
        return
      }
      
      // Calculate progress percentage (assuming 48 hours from notification)
      const totalDuration = 48 * 60 * 60 * 1000 // 48 hours
      const progressPct = Math.max(0, (diff / totalDuration) * 100)
      setProgress(progressPct)
      
      const hours = Math.floor(diff / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      
      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`)
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`)
      } else {
        setTimeLeft(`${seconds}s`)
      }
    }
    
    update()
    const interval = setInterval(update, 1000) // Update every second for better UX
    return () => clearInterval(interval)
  }, [deadline])

  async function handleConfirm() {
    setError(null)
    setConfirming(true)
    try {
      const response = await fetch(
        `/api/enrollment/${enrollmentId}/confirm-waitlist`,
        { method: "POST" }
      )
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error ?? "Could not confirm")
        return
      }
      
      // After confirming, route to document upload
      router.push(
        `/dashboard/guardian/enrollments/${enrollmentId}/upload-documents`
      )
      router.refresh()
    } catch {
      setError("Could not confirm. Please try again.")
    } finally {
      setConfirming(false)
    }
  }

  const isExpired = timeLeft === "Expired"

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className={`relative overflow-hidden rounded-2xl p-6 ${
        isExpired
          ? "bg-linear-to-br from-red-50/80 to-red-50/30 dark:from-red-900/20 dark:to-red-900/5 border border-red-200/50 dark:border-red-800/30"
          : "bg-linear-to-br from-amber-50/80 to-amber-50/30 dark:from-amber-900/20 dark:to-amber-900/5 border border-amber-200/50 dark:border-amber-800/30"
      }`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
        
        <div className="relative">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              {isExpired ? (
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-bold ${
                isExpired
                  ? "text-red-700 dark:text-red-400"
                  : "text-amber-700 dark:text-amber-400"
              }`}>
                {isExpired ? "Offer Expired" : "A Seat Has Become Available! 🎉"}
              </h3>
              <p className={`text-sm leading-relaxed mt-1 ${
                isExpired
                  ? "text-red-600/80 dark:text-red-400/80"
                  : "text-amber-600/80 dark:text-amber-400/80"
              }`}>
                {isExpired 
                  ? "The time to confirm this seat has expired. Please contact the branch for assistance."
                  : "You have been offered a seat from the waitlist. Confirm now to secure your spot."
                }
              </p>
            </div>
          </div>

          {/* Timer */}
          {!isExpired && deadline && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-600/80 dark:text-amber-400/80">
                  Time remaining
                </span>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400 font-mono">
                  {timeLeft}
                </span>
              </div>
              <div className="h-2 rounded-full bg-amber-200/50 dark:bg-amber-800/30 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-linear-to-r from-amber-500 to-amber-600 transition-all duration-1000"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {isExpired && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-50/50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-red-600 dark:text-red-400">
                Please contact the branch to check if the seat is still available.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
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
          className={`w-full rounded-xl py-3 font-semibold transition-all duration-300 ${
            isExpired
              ? "bg-gray-400 cursor-not-allowed opacity-50"
              : "bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
          }`}
          onClick={handleConfirm}
          disabled={confirming || isExpired}
        >
          {confirming ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
              </svg>
              Confirming...
            </span>
          ) : isExpired ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Offer Expired
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Confirm My Seat
            </span>
          )}
        </Button>

        <Button
          variant="outline"
          className="w-full rounded-xl border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-[#6c63ff]/40 hover:text-[#6c63ff] dark:hover:text-[#9d97ff] transition-all"
          onClick={() => router.push(`/dashboard/guardian/enrollments/${enrollmentId}`)}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            View Enrollment Status
          </span>
        </Button>
      </div>

      {/* Helpful info */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/5 border border-blue-100/50 dark:border-blue-800/20">
        <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
            Once confirmed, you'll need to upload the required documents to complete your enrollment.
          </p>
          {!isExpired && (
            <p className="text-xs text-blue-500/80 dark:text-blue-400/80 mt-1">
              ⏰ You have {timeLeft} to confirm this offer before it expires.
            </p>
          )}
        </div>
      </div>

      {/* Decorative elements */}
      {!isExpired && (
        <div className="flex justify-center gap-4 pt-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] text-gray-400 dark:text-gray-500">Offer Active</span>
          </div>
          <div className="w-px h-3 bg-gray-200 dark:bg-white/10" />
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-[10px] text-gray-400 dark:text-gray-500">Seat Reserved</span>
          </div>
          <div className="w-px h-3 bg-gray-200 dark:bg-white/10" />
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-[10px] text-gray-400 dark:text-gray-500">24/7 Support</span>
          </div>
        </div>
      )}
    </div>
  )
}
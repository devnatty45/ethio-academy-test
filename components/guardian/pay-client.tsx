// components/guardian/pay-client.tsx
// Redesigned payment client with modern UI

"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

interface PayClientProps {
  enrollmentId: string
  totalAmount: number
  deadlineAt: string | null
}

export default function PayClient({
  enrollmentId,
  totalAmount,
  deadlineAt,
}: PayClientProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<string | null>(null)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (!deadlineAt) return
    
    function update() {
      const now = Date.now()
      const deadline = new Date(deadlineAt!).getTime()
      const diff = deadline - now
      
      if (diff <= 0) {
        setTimeLeft("Expired")
        setProgress(0)
        return
      }
      
      // Calculate progress percentage (assuming 48 hours initial deadline)
      const totalDuration = 48 * 60 * 60 * 1000 // 48 hours
      const progressPct = Math.max(0, (diff / totalDuration) * 100)
      setProgress(progressPct)
      
      const hours = Math.floor(diff / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      setTimeLeft(`${hours}h ${minutes}m`)
    }
    
    update()
    const interval = setInterval(update, 30000)
    return () => clearInterval(interval)
  }, [deadlineAt])

  async function handlePay() {
    setError(null)
    setLoading(true)
    try {
      const response = await fetch(
        `/api/enrollment/${enrollmentId}/pay/initiate`,
        { method: "POST" }
      )
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not start payment")
        return
      }
      window.location.href = data.checkoutUrl
    } catch {
      setError("Could not start payment. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Amount Card */}
      <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-[#6c63ff]/5 to-[#8b83ff]/5 border border-[#6c63ff]/20 p-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#6c63ff]/5 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#8b83ff]/5 rounded-full blur-2xl" />
        
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Amount Due</p>
            {timeLeft && timeLeft !== "Expired" && (
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{timeLeft}</span>
              </div>
            )}
          </div>
          
          <p className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            {totalAmount.toLocaleString()} <span className="text-lg font-medium text-gray-500 dark:text-gray-400">ETB</span>
          </p>
          
          {/* Progress bar */}
          {deadlineAt && (
            <div className="mt-4 space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-linear-to-r from-[#6c63ff] to-[#8b83ff] transition-all duration-1000"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                Payment window {timeLeft === "Expired" ? "expired" : "active"}
              </p>
            </div>
          )}
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

      <Button
        className="w-full bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white rounded-xl py-3 font-semibold transition-all duration-300 shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40 disabled:opacity-50 disabled:hover:shadow-lg"
        onClick={handlePay}
        disabled={loading || timeLeft === "Expired"}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-3">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
            </svg>
            Redirecting to Chapa...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Pay with Chapa
          </span>
        )}
      </Button>

      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-xs text-gray-400 dark:text-gray-500">Secure checkout</span>
        </div>
        <div className="w-px h-3 bg-gray-200 dark:bg-white/10" />
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-xs text-gray-400 dark:text-gray-500">Chapa secure</span>
        </div>
      </div>
    </div>
  )
}
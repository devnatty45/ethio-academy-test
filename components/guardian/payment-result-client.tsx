// components/guardian/payment-result-client.tsx
// Redesigned payment result client with modern UI

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import ChapaReferenceClaimForm from "./chapa-reference-claim-form"

interface PaymentResultClientProps {
  enrollmentId: string
  initialStatus: string
}

export default function PaymentResultClient({
  enrollmentId,
  initialStatus,
}: PaymentResultClientProps) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [polling, setPolling] = useState(
    initialStatus === "PAYMENT_PENDING"
  )
  const [attempts, setAttempts] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    if (!polling) return
    
    // Timer to show elapsed time
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)

    if (attempts >= 10) {
      setPolling(false)
      clearInterval(timer)
      return
    }

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/guardian/enrollments/${enrollmentId}/status`
        )
        const data = await response.json()
        if (response.ok && data.status) {
          setStatus(data.status)
          if (data.status !== "PAYMENT_PENDING") {
            setPolling(false)
            clearInterval(timer)
          }
        }
      } catch {
        // Silent — will retry
      }
      setAttempts((a) => a + 1)
    }, 3000)

    return () => {
      clearTimeout(timeout)
      clearInterval(timer)
    }
  }, [polling, attempts, enrollmentId])

  // Success state
  if (status === "ENROLLED") {
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
              Payment Confirmed! 🎉
            </h3>
            <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 leading-relaxed">
              Your payment has been successfully confirmed. 
              The enrollment is now complete.
            </p>
          </div>
        </div>

        <Button
          className="w-full bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white rounded-xl py-3 font-semibold transition-all duration-300 shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40"
          onClick={() => router.push("/dashboard/guardian")}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Back to Dashboard
          </span>
        </Button>
      </div>
    )
  }

  // Polling state
  if (status === "PAYMENT_PENDING" && polling) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-amber-50/80 to-amber-50/30 dark:from-amber-900/20 dark:to-amber-900/5 border border-amber-200/50 dark:border-amber-800/30 p-8 text-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
          
          <div className="relative">
            <div className="relative w-20 h-20 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-amber-200/30 dark:border-amber-800/30" />
              <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold text-amber-700 dark:text-amber-400 mb-2">
              Confirming Your Payment
            </h3>
            <p className="text-sm text-amber-600/80 dark:text-amber-400/80 leading-relaxed">
              We're verifying your payment with Chapa. This usually takes a few seconds.
            </p>
            {elapsedTime > 0 && (
              <p className="text-xs text-amber-500/60 dark:text-amber-400/60 mt-2">
                Waiting {elapsedTime}s
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs text-gray-400 dark:text-gray-500">Processing</span>
          </div>
          <div className="w-px h-3 bg-gray-200 dark:bg-white/10" />
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span className="text-xs text-gray-400 dark:text-gray-500">Attempt {attempts + 1}/10</span>
          </div>
        </div>
      </div>
    )
  }

  // Payment pending (polling ended)
  if (status === "PAYMENT_PENDING" && !polling) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-yellow-50/80 to-yellow-50/30 dark:from-yellow-900/20 dark:to-yellow-900/5 border border-yellow-200/50 dark:border-yellow-800/30 p-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl" />
          
          <div className="relative flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                Payment Not Confirmed Yet
              </h4>
              <p className="text-sm text-yellow-600/80 dark:text-yellow-400/80 leading-relaxed mt-1">
                If you completed payment on Chapa, you can submit your 
                merchant reference to confirm it immediately.
              </p>
            </div>
          </div>
        </div>

        <ChapaReferenceClaimForm enrollmentId={enrollmentId} />

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="rounded-xl border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-[#6c63ff]/40 hover:text-[#6c63ff] dark:hover:text-[#9d97ff] transition-all"
            onClick={() => {
              setPolling(true)
              setAttempts(0)
              setElapsedTime(0)
            }}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </span>
          </Button>
          <Button
            variant="outline"
            className="rounded-xl border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-[#6c63ff]/40 hover:text-[#6c63ff] dark:hover:text-[#9d97ff] transition-all"
            onClick={() => router.push(`/dashboard/guardian/enrollments/${enrollmentId}`)}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Check Later
            </span>
          </Button>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Need help? Contact support with your enrollment ID
          </p>
        </div>
      </div>
    )
  }

  // Fallback/Unknown state
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gray-50/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/10 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-3">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
          Current Status: {status}
        </h4>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Please check back later or contact support if this persists.
        </p>
      </div>

      <Button
        className="w-full bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white rounded-xl py-3 font-semibold transition-all duration-300 shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40"
        onClick={() => router.push("/dashboard/guardian")}
      >
        Back to Dashboard
      </Button>
    </div>
  )
}
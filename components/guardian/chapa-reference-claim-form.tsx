// components/guardian/chapa-reference-claim-form.tsx
// Redesigned Chapa reference claim form with modern UI

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ChapaReferenceClaimFormProps {
  enrollmentId: string
}

export default function ChapaReferenceClaimForm({
  enrollmentId,
}: ChapaReferenceClaimFormProps) {
  const router = useRouter()
  const [merchantReference, setMerchantReference] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function handleSubmit() {
    setError(null)
    if (!merchantReference.trim()) {
      setError("Enter your merchant reference")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(
        `/api/enrollment/${enrollmentId}/pay/claim-reference`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchantReference: merchantReference.trim(),
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not verify reference")
        return
      }

      router.push(
        `/dashboard/guardian/enrollments/${enrollmentId}/pay/result`
      )
      router.refresh()
    } catch {
      setError("Could not verify. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-[#6c63ff] dark:hover:text-[#9d97ff] transition-colors group"
      >
        <svg className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Payment not updating? Submit your payment reference
      </button>
    )
  }

  return (
    <div className="rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/20 p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Payment Reference Verification
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Find the Merchant reference on your Chapa receipt under "References → Merchant"
          </p>
        </div>
        <button
          onClick={() => {
            setOpen(false)
            setError(null)
            setMerchantReference("")
          }}
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="merchant-ref" className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Merchant Reference <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <Input
              id="merchant-ref"
              value={merchantReference}
              onChange={(e) => setMerchantReference(e.target.value)}
              placeholder="ENR-a21e8222-755e5b80"
              maxLength={100}
              className="pl-9 font-mono text-sm rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
            />
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Format: ENR-xxxxxxxx-xxxxxxxx (found on your Chapa receipt)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !merchantReference.trim()}
            className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white rounded-lg"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                </svg>
                Verifying...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Verify with Chapa
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false)
              setError(null)
              setMerchantReference("")
            }}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </Button>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            Limited to 3 attempts per hour
          </p>
        </div>

        <div className="p-3 rounded-lg bg-blue-50/30 dark:bg-blue-900/5 border border-blue-100/50 dark:border-blue-800/10">
          <p className="text-[10px] text-blue-600 dark:text-blue-400 leading-relaxed">
            💡 <span className="font-medium">Tip:</span> Do not enter the Chapa reference 
            (the one starting with "AP..."). Only use the merchant reference that starts with "ENR-".
          </p>
        </div>
      </div>
    </div>
  )
}
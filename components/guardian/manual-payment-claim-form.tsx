// components/guardian/manual-payment-claim-form.tsx
// Redesigned manual payment claim form with modern UI

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface ManualPaymentClaimFormProps {
  enrollmentId: string
  totalAmount: number
}

export default function ManualPaymentClaimForm({
  enrollmentId,
  totalAmount,
}: ManualPaymentClaimFormProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [amountPaid, setAmountPaid] = useState(totalAmount.toString())
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [paymentMethod, setPaymentMethod] = useState<
    "BANK_TRANSFER" | "CASH"
  >("BANK_TRANSFER")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [notes, setNotes] = useState("")
  const [proofFile, setProofFile] = useState<{
    publicId: string
    fileName: string
  } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileUpload(file: File) {
    setUploading(true)
    setError(null)
    try {
      if (file.size > 10 * 1024 * 1024) {
        setError("File must be smaller than 10MB")
        return
      }
      const allowedTypes = ["image/jpeg", "image/png", "application/pdf"]
      if (!allowedTypes.includes(file.type)) {
        setError("Only JPG, PNG, and PDF files are allowed")
        return
      }

      const sigResponse = await fetch("/api/upload/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType: "payment_proof",
          academicYearName: "payment-proof",
          branchId: "00000000-0000-0000-0000-000000000000",
          studentId: "00000000-0000-0000-0000-000000000000",
          enrollmentId,
          fileExtension:
            file.name.split(".").pop()?.toLowerCase() ?? "jpg",
        }),
      })

      if (!sigResponse.ok) {
        setError("Could not start upload")
        return
      }

      const sig = await sigResponse.json()
      const formData = new FormData()
      formData.append("file", file)
      formData.append("api_key", sig.apiKey)
      formData.append("timestamp", sig.timestamp.toString())
      formData.append("signature", sig.signature)
      formData.append("upload_preset", sig.uploadPreset)
      formData.append("folder", sig.folder)
      formData.append("public_id", sig.publicId)

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`,
        { method: "POST", body: formData }
      )

      if (!uploadResponse.ok) {
        setError("Upload failed")
        return
      }

      const uploadResult = await uploadResponse.json()
      setProofFile({
        publicId: uploadResult.public_id,
        fileName: file.name,
      })
    } catch {
      setError("Upload failed. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit() {
    setError(null)
    if (!proofFile) {
      setError("Upload proof of payment first")
      return
    }
    if (!amountPaid || parseFloat(amountPaid) <= 0) {
      setError("Enter a valid amount")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(
        `/api/enrollment/${enrollmentId}/pay/manual-claim`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountPaid: parseFloat(amountPaid),
            paymentDate,
            paymentMethod,
            referenceNumber: referenceNumber.trim() || undefined,
            proofDocumentPublicId: proofFile.publicId,
            notes: notes.trim() || undefined,
          }),
        }
      )
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not submit claim")
        return
      }
      router.push(`/dashboard/guardian/enrollments/${enrollmentId}`)
      router.refresh()
    } catch {
      setError("Could not submit claim. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 text-sm text-[#6c63ff] dark:text-[#9d97ff] hover:text-[#5a52e0] dark:hover:text-[#8b83ff] transition-colors font-medium group"
      >
        <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Claim manual payment
      </button>
    )
  }

  return (
    <div className="rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5 p-5 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white">Manual Payment Claim</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Submit proof of payment for manual verification
          </p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
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

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">Payment Method</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["BANK_TRANSFER", "CASH"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMethod(m)}
                className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  paymentMethod === m
                    ? "bg-[#6c63ff]/10 border-[#6c63ff]/50 text-[#6c63ff] dark:text-[#9d97ff] shadow-sm"
                    : "bg-transparent border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                }`}
              >
                {m === "BANK_TRANSFER" ? "🏦 Bank Transfer" : "💵 Cash"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="amount-paid" className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Amount Paid (ETB)
            </Label>
            <Input
              id="amount-paid"
              type="number"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              min="0"
              step="0.01"
              className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-date" className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Payment Date
            </Label>
            <Input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
            />
          </div>
        </div>

        {paymentMethod === "BANK_TRANSFER" && (
          <div className="space-y-2">
            <Label htmlFor="reference-number" className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Bank Reference Number <span className="text-gray-400">(optional)</span>
            </Label>
            <Input
              id="reference-number"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Transaction reference from your bank"
              className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Proof of Payment <span className="text-red-500">*</span>
          </Label>
          {proofFile ? (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/3 px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{proofFile.fileName}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setProofFile(null)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Remove
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file)
                }}
                className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#6c63ff]/10 file:text-[#6c63ff] hover:file:bg-[#6c63ff]/20"
              />
              {uploading && (
                <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center rounded-lg">
                  <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                    </svg>
                    Uploading...
                  </span>
                </div>
              )}
            </div>
          )}
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Accepted formats: JPG, PNG, PDF (Max 10MB)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes" className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Notes <span className="text-gray-400">(optional)</span>
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional details about this payment"
            rows={2}
            maxLength={500}
            className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 resize-none"
          />
        </div>

        <Button
          className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white rounded-lg py-2.5 font-semibold transition-all disabled:opacity-50"
          onClick={handleSubmit}
          disabled={submitting || uploading || !proofFile}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
              </svg>
              Submitting...
            </span>
          ) : (
            "Submit Payment Claim"
          )}
        </Button>
      </div>
    </div>
  )
}
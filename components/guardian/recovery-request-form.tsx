// components/guardian/recovery-request-form.tsx
// Redesigned account recovery form with modern UI

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface UploadedFile {
  publicId: string
  fileName: string
}

export default function RecoveryRequestForm() {
  const router = useRouter()
  const [claimedFullName, setClaimedFullName] = useState("")
  const [claimedPhone, setClaimedPhone] = useState("")
  const [claimedFanFin, setClaimedFanFin] = useState("")
  const [idFront, setIdFront] = useState<UploadedFile | null>(null)
  const [idBack, setIdBack] = useState<UploadedFile | null>(null)
  const [claimedStudentName, setClaimedStudentName] = useState("")
  const [claimedStudentDob, setClaimedStudentDob] = useState("")
  const [recoveryReason, setRecoveryReason] = useState("")
  const [uploadingFront, setUploadingFront] = useState(false)
  const [uploadingBack, setUploadingBack] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [confidenceLevel, setConfidenceLevel] = useState<string | null>(
    null
  )

  async function handleFileUpload(
    file: File,
    docType: "national_id_front" | "national_id_back",
    setUploading: (v: boolean) => void,
    setUploaded: (v: UploadedFile) => void
  ) {
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
          docType,
          academicYearName: "recovery",
          branchId: "00000000-0000-0000-0000-000000000000",
          studentId: "00000000-0000-0000-0000-000000000000",
          enrollmentId: "00000000-0000-0000-0000-000000000000",
          fileExtension:
            file.name.split(".").pop()?.toLowerCase() ?? "jpg",
        }),
      })

      if (!sigResponse.ok) {
        setError("Upload failed. Please try again.")
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
        setError("Upload failed. Please try again.")
        return
      }

      const uploadResult = await uploadResponse.json()
      setUploaded({
        publicId: uploadResult.public_id,
        fileName: file.name,
      })
    } catch {
      setError("Upload failed. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!idFront || !idBack) {
      setError("Both national ID photos are required")
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch("/api/guardian/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimedFullName,
          claimedPhone,
          claimedFanFin,
          nationalIdFrontPublicId: idFront.publicId,
          nationalIdBackPublicId: idBack.publicId,
          claimedStudentName,
          claimedStudentDob,
          recoveryReason,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not submit request. Please try again.")
        return
      }

      setConfidenceLevel(data.confidenceLevel)
      setSubmitted(true)
    } catch {
      setError("Could not submit request. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    const isHigh = confidenceLevel === "HIGH"
    const isMedium = confidenceLevel === "MEDIUM"
    const isLow = confidenceLevel === "LOW"

    return (
      <div className="space-y-6">
        <div className={`relative overflow-hidden rounded-xl p-6 ${
          isHigh
            ? "bg-linear-to-br from-emerald-50/80 to-emerald-50/30 dark:from-emerald-900/20 dark:to-emerald-900/5 border border-emerald-200/50 dark:border-emerald-800/30"
            : isMedium
            ? "bg-linear-to-br from-amber-50/80 to-amber-50/30 dark:from-amber-900/20 dark:to-amber-900/5 border border-amber-200/50 dark:border-amber-800/30"
            : "bg-linear-to-br from-gray-50/80 to-gray-50/30 dark:from-white/5 dark:to-white/3 border border-gray-200/50 dark:border-white/10"
        }`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
          
          <div className="relative flex items-start gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
              isHigh
                ? "bg-emerald-500/20"
                : isMedium
                ? "bg-amber-500/20"
                : "bg-gray-500/20"
            }`}>
              {isHigh ? (
                <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : isMedium ? (
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div>
              <h3 className={`text-lg font-bold ${
                isHigh
                  ? "text-emerald-700 dark:text-emerald-400"
                  : isMedium
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-gray-700 dark:text-gray-300"
              }`}>
                {isHigh ? "✓ Recovery Request Submitted!" :
                 isMedium ? "Recovery Request Submitted" :
                 "Recovery Request Submitted"}
              </h3>
              
              <div className="mt-2 space-y-1">
                {isHigh && (
                  <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 leading-relaxed">
                    Strong match found! Your request will be reviewed by an administrator shortly.
                  </p>
                )}
                {isMedium && (
                  <p className="text-sm text-amber-600/80 dark:text-amber-400/80 leading-relaxed">
                    Partial match found. An administrator will review your request and ID photos.
                  </p>
                )}
                {isLow && (
                  <p className="text-sm text-gray-600/80 dark:text-gray-400/80 leading-relaxed">
                    Low match confidence. You may be required to visit the school in person with your original ID documents.
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Confidence:</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    isHigh
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : isMedium
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                      : "bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-400"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      isHigh ? "bg-emerald-500" :
                      isMedium ? "bg-amber-500" :
                      "bg-gray-500"
                    }`} />
                    {confidenceLevel}
                  </span>
                </div>
              </div>
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/20">
        <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Verification Required</p>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed mt-0.5">
            Enter the details from your original account. These will be matched against our records to verify your identity.
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

      {/* Guardian Details Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Guardian Information</h3>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="claimed-name" className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Full Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="claimed-name"
            value={claimedFullName}
            onChange={(e) => setClaimedFullName(e.target.value)}
            placeholder="Your full name as registered"
            required
            minLength={2}
            maxLength={100}
            className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="claimed-phone" className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Phone Number <span className="text-red-500">*</span>
          </Label>
          <Input
            id="claimed-phone"
            value={claimedPhone}
            onChange={(e) => setClaimedPhone(e.target.value)}
            placeholder="09XXXXXXXX"
            required
            className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="claimed-fan-fin" className="text-xs font-medium text-gray-600 dark:text-gray-400">
            FAN/FIN Number <span className="text-red-500">*</span>
          </Label>
          <Input
            id="claimed-fan-fin"
            value={claimedFanFin}
            onChange={(e) => setClaimedFanFin(e.target.value.replace(/\D/g, ""))}
            placeholder="Your Fayda ID number"
            required
            inputMode="numeric"
            maxLength={20}
            className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 font-mono"
          />
        </div>
      </div>

      {/* National ID Upload Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">National ID Verification</h3>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              ID — Front Photo <span className="text-red-500">*</span>
            </Label>
            {idFront ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-900/10 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{idFront.fileName}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIdFront(null)}
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
                  disabled={uploadingFront}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file)
                      handleFileUpload(
                        file,
                        "national_id_front",
                        setUploadingFront,
                        setIdFront
                      )
                  }}
                  className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#6c63ff]/10 file:text-[#6c63ff] hover:file:bg-[#6c63ff]/20"
                />
                {uploadingFront && (
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
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              ID — Back Photo <span className="text-red-500">*</span>
            </Label>
            {idBack ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-900/10 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{idBack.fileName}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIdBack(null)}
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
                  disabled={uploadingBack}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file)
                      handleFileUpload(
                        file,
                        "national_id_back",
                        setUploadingBack,
                        setIdBack
                      )
                  }}
                  className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#6c63ff]/10 file:text-[#6c63ff] hover:file:bg-[#6c63ff]/20"
                />
                {uploadingBack && (
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
          </div>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          Accepted formats: JPG, PNG, PDF (Max 10MB per file)
        </p>
      </div>

      {/* Student Details Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Student Verification</h3>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="student-name" className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Student's Full Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="student-name"
            value={claimedStudentName}
            onChange={(e) => setClaimedStudentName(e.target.value)}
            placeholder="Name of one of your children"
            required
            minLength={2}
            maxLength={100}
            className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="student-dob" className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Student's Date of Birth <span className="text-red-500">*</span>
          </Label>
          <Input
            id="student-dob"
            type="date"
            value={claimedStudentDob}
            onChange={(e) => setClaimedStudentDob(e.target.value)}
            required
            max={new Date().toISOString().split("T")[0]}
            className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
          />
        </div>
      </div>

      {/* Recovery Reason */}
      <div className="space-y-2">
        <Label htmlFor="recovery-reason" className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Reason for Account Recovery <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="recovery-reason"
          value={recoveryReason}
          onChange={(e) => setRecoveryReason(e.target.value)}
          placeholder="Explain why you need to recover your account"
          required
          minLength={10}
          maxLength={1000}
          rows={3}
          className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 resize-none"
        />
        <p className="text-[10px] text-gray-400 dark:text-gray-500 text-right">
          {recoveryReason.length}/1000 characters
        </p>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white rounded-xl py-3 font-semibold transition-all duration-300 shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40 disabled:opacity-50 disabled:hover:shadow-lg"
        disabled={submitting || uploadingFront || uploadingBack || !idFront || !idBack}
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-3">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
            </svg>
            Submitting Request...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Submit Recovery Request
          </span>
        )}
      </Button>

      {/* Security note */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Secure & Encrypted</span>
        </div>
        <div className="w-px h-3 bg-gray-200 dark:bg-white/10" />
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">ID Verified</span>
        </div>
      </div>
    </form>
  )
}
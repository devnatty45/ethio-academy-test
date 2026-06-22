// components/guardian/profile-completion-form.tsx
// Redesigned profile completion form with modern UI

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

interface ProfileCompletionFormProps {
  userId: string
}

export default function ProfileCompletionForm({
  userId,
}: ProfileCompletionFormProps) {
  const router = useRouter()

  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [fanFin, setFanFin] = useState("")
  const [address, setAddress] = useState("")
  const [idFront, setIdFront] = useState<UploadedFile | null>(null)
  const [idBack, setIdBack] = useState<UploadedFile | null>(null)
  const [uploadingFront, setUploadingFront] = useState(false)
  const [uploadingBack, setUploadingBack] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          academicYearName: "profile",
          branchId: "00000000-0000-0000-0000-000000000000",
          studentId: userId,
          enrollmentId: "00000000-0000-0000-0000-000000000000",
          fileExtension: file.name.split(".").pop()?.toLowerCase() ?? "jpg",
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
      const response = await fetch("/api/guardian/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          fanFin,
          nationalIdFrontPublicId: idFront.publicId,
          nationalIdBackPublicId: idBack.publicId,
          residentialAddress: address,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error ?? "Could not save profile. Please try again.")
        return
      }

      router.push("/dashboard/guardian")
      router.refresh()
    } catch {
      setError("Could not save profile. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-linear-to-r from-[#6c63ff] to-[#8b83ff] transition-all duration-500" style={{ width: '0%' }} />
        </div>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Step 1 of 1</span>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Personal Information Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Personal Information</h3>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Full Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full legal name"
            required
            minLength={2}
            maxLength={100}
            className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Phone Number <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09XXXXXXXX or +251XXXXXXXXX"
              required
              className="pl-9 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
            />
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Ethiopian phone number — used for SMS notifications
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fanFin" className="text-xs font-medium text-gray-600 dark:text-gray-400">
            FAN/FIN Number (Fayda ID) <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
              </svg>
            </div>
            <Input
              id="fanFin"
              value={fanFin}
              onChange={(e) => setFanFin(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter your Fayda ID number"
              required
              inputMode="numeric"
              maxLength={20}
              className="pl-9 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 font-mono"
            />
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Your Ethiopian national identification number. This is encrypted and stored securely.
          </p>
        </div>
      </div>

      {/* National ID Upload Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">ID Verification</h3>
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
                    if (file) {
                      handleFileUpload(
                        file,
                        "national_id_front",
                        setUploadingFront,
                        setIdFront
                      )
                    }
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
                    if (file) {
                      handleFileUpload(
                        file,
                        "national_id_back",
                        setUploadingBack,
                        setIdBack
                      )
                    }
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

      {/* Address Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Residential Address</h3>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Address <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter your full residential address"
              required
              minLength={5}
              maxLength={500}
              rows={3}
              className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 resize-none"
            />
            <div className="absolute bottom-3 right-3 text-[10px] text-gray-400 dark:text-gray-500">
              {address.length}/500
            </div>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2 space-y-3">
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
              Saving Profile...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Save Profile & Continue
            </span>
          )}
        </Button>

        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">Encrypted Storage</span>
          </div>
          <div className="w-px h-3 bg-gray-200 dark:bg-white/10" />
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">ID Verified</span>
          </div>
        </div>
      </div>
    </form>
  )
}
// components/guardian/document-upload-item.tsx
// Single document upload item — handles one document type
// Supports fresh upload and reuse from previous enrollment
// Client component

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ReusedFrom {
  enrollmentId: string
  publicId: string
}

interface DocumentUploadItemProps {
  enrollmentId: string
  docType: string
  label: string
  isRequired: boolean
  isReusable: boolean
  reusedFrom: ReusedFrom | null
  existingPublicId: string | null
  verificationStatus: string | null
  rejectionNote: string | null
  academicYearName: string
  branchId: string
  studentId: string
  onUploadComplete: (docType: string, publicId: string) => void
}

const DOC_TYPE_LABELS: Record<string, string> = {
  guardian_photo: "Guardian Photo",
  student_photo: "Student Photo",
  national_id_front: "National ID — Front",
  national_id_back: "National ID — Back",
  birth_certificate: "Birth Certificate",
  grade_certificate: "Grade Certificate",
  grade_6_exam_cert: "Grade 6 Exam Certificate",
  grade_8_exam_cert: "Grade 8 Exam Certificate",
}

export default function DocumentUploadItem({
  enrollmentId,
  docType,
  label,
  isRequired,
  isReusable,
  reusedFrom,
  existingPublicId,
  verificationStatus,
  rejectionNote,
  academicYearName,
  branchId,
  studentId,
  onUploadComplete,
}: DocumentUploadItemProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState(
    existingPublicId !== null
  )
  const [isReused, setIsReused] = useState(reusedFrom !== null)

  const displayLabel =
    DOC_TYPE_LABELS[docType] ?? label

  async function handleFileSelect(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setUploadProgress(0)

    // Client-side validation
    if (file.size > 10 * 1024 * 1024) {
      setError("File must be smaller than 10MB")
      return
    }

    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"]
    if (!allowedTypes.includes(file.type)) {
      setError("Only JPG, PNG, and PDF files are allowed")
      return
    }

    // Replace the ext extraction line
    const rawExt = file.name.split(".").pop()?.toLowerCase() ?? ""
    const ext = ["jpg", "jpeg", "png", "pdf"].includes(rawExt)
      ? rawExt
      : file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/png"
      ? "png"
      : "jpg"

    setUploading(true)

    try {
      // Get upload signature
      const sigResponse = await fetch("/api/upload/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType,
          academicYearName,
          branchId,
          studentId,
          enrollmentId,
          fileExtension: ext,
        }),
      })

      // Replace the sig fetch error handler
      if (!sigResponse.ok) {
        const sigError = await sigResponse.json().catch(() => ({}))
        setError(
          `Could not start upload: ${sigError.error ?? sigResponse.status}. Please try again.`
        )
        return
      }

      const sig = await sigResponse.json()

      // Upload to Cloudinary using XMLHttpRequest for progress
      await new Promise<void>((resolve, reject) => {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("api_key", sig.apiKey)
        formData.append("timestamp", sig.timestamp.toString())
        formData.append("signature", sig.signature)
        formData.append("upload_preset", sig.uploadPreset)
        formData.append("folder", sig.folder)
        formData.append("public_id", sig.publicId)

        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setUploadProgress(
              Math.round((e.loaded / e.total) * 100)
            )
          }
        })

        // In the xhr.addEventListener("load") handler
        // Replace the existing onload handler with this:

        xhr.addEventListener("load", async () => {
          if (xhr.status === 200) {
            const uploadResult = JSON.parse(xhr.responseText)

            // Validate magic bytes before creating document record
            const validateResponse = await fetch("/api/upload/validate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                publicId: uploadResult.public_id,
                enrollmentId,
                docType,
              }),
            })

            const validateData = await validateResponse.json()

            if (!validateResponse.ok || !validateData.valid) {
              reject(
                new Error(
                  validateData.error ??
                    "File type validation failed. Please upload a valid JPG, PNG, or PDF."
                )
              )
              return
            }

            // Validation passed — create document record
            const docResponse = await fetch(
              `/api/enrollment/${enrollmentId}/documents`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  docType,
                  cloudinaryPublicId: uploadResult.public_id,
                  cloudinaryVersion: String(uploadResult.version),
                }),
              }
            )

            if (docResponse.ok) {
              setUploaded(true)
              setIsReused(false)
              onUploadComplete(docType, uploadResult.public_id)
              resolve()
            } else {
              reject(new Error("Could not save document"))
            }
          } else {
            reject(new Error("Upload failed"))
          }
        })

        xhr.addEventListener("error", () =>
          reject(new Error("Upload failed"))
        )

        xhr.open(
          "POST",
          `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`
        )
        xhr.send(formData)
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Upload failed"
      )
    } finally {
      setUploading(false)
      setUploadProgress(0)
      // Reset file input
      e.target.value = ""
    }
  }

  async function handleUseReused() {
    if (!reusedFrom) return
    setError(null)

    try {
      const response = await fetch(
        `/api/enrollment/${enrollmentId}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docType,
            cloudinaryPublicId: reusedFrom.publicId,
            isReusedFromEnrollmentId: reusedFrom.enrollmentId,
          }),
        }
      )

      if (response.ok) {
        setUploaded(true)
        setIsReused(true)
        onUploadComplete(docType, reusedFrom.publicId)
      } else {
        setError("Could not reuse document")
      }
    } catch {
      setError("Could not reuse document")
    }
  }

  const isRejected = verificationStatus === "REJECTED"
  const isVerified = verificationStatus === "VERIFIED"

  return (
    <div
      className={`rounded-md border p-4 space-y-3 ${
        isRejected
          ? "border-destructive/50 bg-destructive/5"
          : isVerified
          ? "border-green-200 bg-green-50 dark:bg-green-900/10"
          : uploaded
          ? "border-border bg-muted/20"
          : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            {displayLabel}
            {isRequired && (
              <span className="text-destructive ml-1">*</span>
            )}
          </p>
          {isReused && (
            <p className="text-xs text-muted-foreground">
              Reused from previous enrollment
            </p>
          )}
          {isVerified && (
            <p className="text-xs text-green-700 dark:text-green-400">
              ✓ Verified
            </p>
          )}
          {isRejected && (
            <p className="text-xs text-destructive">
              Rejected
              {rejectionNote && `: ${rejectionNote}`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {uploaded && !isRejected && (
            <span className="text-xs text-muted-foreground">
              {isVerified ? "✓" : "Uploaded"}
            </span>
          )}
        </div>
      </div>

      {/* Reuse option for eligible docs */}
      {reusedFrom && !uploaded && !isVerified && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUseReused}
          >
            Reuse from previous enrollment
          </Button>
          <span className="text-xs text-muted-foreground">or</span>
        </div>
      )}

      {/* Upload input */}
      {!isVerified && (
        <div className="space-y-2">
          <Input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            disabled={uploading}
            onChange={handleFileSelect}
            className="text-sm"
          />

          {uploading && (
            <div className="space-y-1">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-foreground rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {uploaded && !uploading && (
            <p className="text-xs text-muted-foreground">
              {isRejected
                ? "Upload a replacement file"
                : "File uploaded — you can replace it by uploading again"}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
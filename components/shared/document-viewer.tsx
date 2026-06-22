// components/shared/document-viewer.tsx
// Redesigned secure document viewer with modern UI

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface DocumentViewerProps {
  documentId: string
  docType: string
  verificationStatus?: string
  label?: string
  mode?: "preview" | "tab"
}

const DOC_TYPE_LABELS: Record<string, string> = {
  guardian_photo: "Guardian Photo",
  student_photo: "Student Photo",
  national_id_front: "National ID (Front)",
  national_id_back: "National ID (Back)",
  birth_certificate: "Birth Certificate",
  grade_certificate: "Grade Certificate",
  grade_6_exam_cert: "Grade 6 Exam Certificate",
  grade_8_exam_cert: "Grade 8 Exam Certificate",
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PENDING: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200/50 dark:border-amber-800/30"
  },
  VERIFIED: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200/50 dark:border-emerald-800/30"
  },
  REJECTED: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200/50 dark:border-red-800/30"
  },
}

export default function DocumentViewer({
  documentId,
  docType,
  verificationStatus,
  label,
  mode = "tab",
}: DocumentViewerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isHovered, setIsHovered] = useState(false)

  const displayLabel = label ?? DOC_TYPE_LABELS[docType] ?? docType
  const statusConfig = verificationStatus ? STATUS_COLORS[verificationStatus] : null

  async function fetchSignedUrl(): Promise<string | null> {
    setError(null)
    setLoading(true)

    try {
      const response = await fetch(
        `/api/documents/${documentId}/view`
      )
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not load document")
        return null
      }

      return data.url
    } catch {
      setError("Could not load document")
      return null
    } finally {
      setLoading(false)
    }
  }

  async function handleView() {
    const url = await fetchSignedUrl()
    if (!url) return

    if (mode === "tab") {
      window.open(url, "_blank", "noopener,noreferrer")
    } else {
      setPreviewUrl(url)
      setTimeout(() => setPreviewUrl(null), 14 * 60 * 1000)
    }
  }

  return (
    <div className="space-y-2">
      {/* Main viewer button - redesigned */}
      <div 
        className="relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleView}
          disabled={loading}
          className={`relative group transition-all duration-300 ${
            loading 
              ? "opacity-70 cursor-wait" 
              : "hover:border-[#6c63ff]/40 hover:text-[#6c63ff] dark:hover:text-[#9d97ff] hover:shadow-md"
          } ${
            verificationStatus === "VERIFIED" 
              ? "border-emerald-200 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-400 hover:border-emerald-400"
              : verificationStatus === "REJECTED"
              ? "border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-400 hover:border-red-400"
              : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400"
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
              </svg>
              Loading...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Document
              {isHovered && (
                <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </span>
          )}
        </Button>

        {/* Tooltip for status */}
        {verificationStatus && statusConfig && (
          <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
            verificationStatus === "VERIFIED" ? "bg-emerald-500" :
            verificationStatus === "REJECTED" ? "bg-red-500" :
            "bg-amber-500"
          } border-2 border-white dark:border-[#13132b]`} />
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Inline preview mode */}
      {mode === "preview" && previewUrl && (
        <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden bg-white dark:bg-[#0d0d1a] shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="relative">
            {previewUrl.includes(".pdf") || previewUrl.includes("/raw/") ? (
              <iframe
                src={previewUrl}
                className="w-full h-80 md:h-96"
                title={displayLabel}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={displayLabel}
                className="w-full max-h-96 object-contain bg-gray-50 dark:bg-white/3"
              />
            )}
          </div>
          
          {/* Preview footer */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 dark:bg-white/5 border-t border-gray-100/50 dark:border-white/5">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Preview expires in <span className="font-medium text-gray-700 dark:text-gray-300">14 minutes</span>
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewUrl(null)}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-white/10"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
// components/admin/mfa-setup-form.tsx
// Redesigned MFA setup form with modern UI

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { UserRole } from "@/types/database"

type Stage = "loading" | "scan" | "verify" | "backup" | "error"

interface MfaSetupFormProps {
  userRole: UserRole
}

export default function MfaSetupForm({ userRole }: MfaSetupFormProps) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>("loading")
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("")
  const [code, setCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  useEffect(() => {
    async function fetchQrCode() {
      try {
        const response = await fetch("/api/admin/mfa/setup")
        if (!response.ok) {
          setStage("error")
          return
        }
        const data = await response.json()
        setQrCodeDataUrl(data.qrCodeDataUrl)
        setStage("scan")
      } catch {
        setStage("error")
      }
    }
    fetchQrCode()
  }, [])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch("/api/admin/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Verification failed. Please try again.")
        return
      }

      setBackupCodes(data.backupCodes)
      setStage("backup")
    } catch {
      setError("Verification failed. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  function handleDownloadBackupCodes() {
    const date = new Date().toISOString().split("T")[0]
    const content = [
      "School Registration System — MFA Backup Codes",
      `Generated: ${date}`,
      "",
      "Each code can only be used once.",
      "Store this file somewhere safe and private.",
      "These codes will not be shown again.",
      "",
      ...backupCodes.map((c, i) => `${i + 1}. ${c}`),
    ].join("\n")

    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `backup-codes-${date}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setDownloaded(true)
  }

  function handleContinueToDashboard() {
    if (userRole === "BRANCH_ADMIN") {
      router.push("/dashboard/branch")
    } else {
      router.push("/dashboard/master")
    }
    router.refresh()
  }

  if (stage === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          Generating setup code...
        </p>
      </div>
    )
  }

  if (stage === "error") {
    return (
      <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-red-50/80 to-red-50/30 dark:from-red-900/20 dark:to-red-900/5 border border-red-200/50 dark:border-red-800/30 p-6 text-center">
        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />
        
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">
            Setup Error
          </h3>
          <p className="text-sm text-red-600/80 dark:text-red-400/80">
            Setup could not be loaded. Please refresh the page.
          </p>
          <Button
            variant="outline"
            className="mt-4 rounded-xl border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-[#6c63ff]/40 hover:text-[#6c63ff] dark:hover:text-[#9d97ff] transition-all"
            onClick={() => window.location.reload()}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Page
            </span>
          </Button>
        </div>
      </div>
    )
  }

  if (stage === "scan") {
    return (
      <div className="space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#6c63ff] text-white flex items-center justify-center text-xs font-bold">
              1
            </div>
            <span className="text-xs font-medium text-[#6c63ff] dark:text-[#9d97ff]">Scan</span>
          </div>
          <div className="flex-1 h-px bg-[#6c63ff]/30" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400 flex items-center justify-center text-xs font-bold">
              2
            </div>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Verify</span>
          </div>
          <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400 flex items-center justify-center text-xs font-bold">
              3
            </div>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Backup</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Step 1 — Scan QR Code
            </h3>
          </div>
          
          <div className="relative flex justify-center rounded-xl bg-linear-to-br from-gray-50/50 to-gray-50/30 dark:from-white/5 dark:to-white/3 border border-gray-200/50 dark:border-white/10 p-6">
            <div className="absolute top-0 right-0 w-20 h-20 bg-[#6c63ff]/5 rounded-full blur-2xl" />
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeDataUrl}
                alt="MFA QR Code"
                width={200}
                height={200}
                className="rounded-lg"
              />
              <div className="absolute -inset-1 bg-linear-to-r from-[#6c63ff]/10 via-transparent to-[#8b83ff]/10 rounded-xl blur" />
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/20">
            <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Open Google Authenticator → tap + → scan QR code
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100/50 dark:border-white/5 pt-4">
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Step 2 — Enter 6-digit verification code
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  className="pl-9 text-center text-lg font-mono tracking-widest rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
                <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white rounded-xl py-3 font-semibold transition-all duration-300 shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40 disabled:opacity-50 disabled:hover:shadow-lg"
              disabled={submitting || code.length !== 6}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                  </svg>
                  Verifying...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Verify & Continue
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>
    )
  }

  if (stage === "backup") {
    return (
      <div className="space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
              ✓
            </div>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Scan</span>
          </div>
          <div className="flex-1 h-px bg-emerald-300 dark:bg-emerald-800/40" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
              ✓
            </div>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Verify</span>
          </div>
          <div className="flex-1 h-px bg-emerald-300 dark:bg-emerald-800/40" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#6c63ff] text-white flex items-center justify-center text-xs font-bold">
              3
            </div>
            <span className="text-xs font-medium text-[#6c63ff] dark:text-[#9d97ff]">Backup</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-amber-50/80 to-amber-50/30 dark:from-amber-900/20 dark:to-amber-900/5 border border-amber-200/50 dark:border-amber-800/30 p-4">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl" />
          
          <div className="relative flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Save Your Backup Codes
              </h3>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/80 leading-relaxed mt-1">
                Download these 8 codes and store them somewhere safe. 
                Each code can only be used once. They will not be shown again after you leave this page.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-linear-to-br from-gray-50/50 to-gray-50/30 dark:from-white/5 dark:to-white/3 border border-gray-200/50 dark:border-white/10 p-4">
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg bg-white dark:bg-white/5 px-3 py-2 border border-gray-100/50 dark:border-white/5"
              >
                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <code className="text-sm font-mono text-gray-800 dark:text-white flex-1 text-center">
                  {c}
                </code>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            className={`w-full rounded-xl border-2 transition-all duration-300 ${
              downloaded
                ? "border-emerald-200 dark:border-emerald-800/30 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400"
                : "border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-[#6c63ff]/40 hover:text-[#6c63ff] dark:hover:text-[#9d97ff]"
            }`}
            onClick={handleDownloadBackupCodes}
          >
            <span className="flex items-center justify-center gap-2">
              {downloaded ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Downloaded ✓
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Backup Codes (.txt)
                </>
              )}
            </span>
          </Button>

          <Button
            className="w-full bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white rounded-xl py-3 font-semibold transition-all duration-300 shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40 disabled:opacity-50 disabled:hover:shadow-lg"
            onClick={handleContinueToDashboard}
            disabled={!downloaded}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              I Have Downloaded My Codes — Continue
            </span>
          </Button>

          {!downloaded && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/20">
              <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                You must download your backup codes before continuing.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-red-50/50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
          <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-red-600 dark:text-red-400">
            These codes will not be shown again after leaving this page.
          </p>
        </div>
      </div>
    )
  }

  return null
}
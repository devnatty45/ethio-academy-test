// components/admin/sensitive-action-modal.tsx
// Reusable re-verification modal with GitHub-style OTP input

"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface SensitiveActionModalProps {
  actionDescription: string
  onVerified: () => void
  children: React.ReactNode
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost"
  disabled?: boolean
}

export default function SensitiveActionModal({
  actionDescription,
  onVerified,
  children,
  variant = "default",
  disabled = false,
}: SensitiveActionModalProps) {
  const [showModal, setShowModal] = useState(false)
  const [code, setCode] = useState<string[]>(Array(6).fill(""))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [locked, setLocked] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  async function handleTriggerClick() {
    try {
      const response = await fetch("/api/master/mfa/reverify/status")
      const data = await response.json()

      if (data.verified) {
        onVerified()
        return
      }
    } catch {
      // Show modal if check fails
    }

    setShowModal(true)
    setCode(Array(6).fill(""))
    setError(null)
    setLocked(false)
    // Focus first input after modal opens
    setTimeout(() => inputRefs.current[0]?.focus(), 100)
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const fullCode = code.join("")
    if (fullCode.length !== 6) {
      setError("Please enter all 6 digits")
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch("/api/master/mfa/reverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: fullCode, actionDescription }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 423) {
          setLocked(true)
        }
        setError(data.error ?? "Verification failed.")
        setCode(Array(6).fill(""))
        inputRefs.current[0]?.focus()
        return
      }

      setShowModal(false)
      setCode(Array(6).fill(""))
      onVerified()
    } catch {
      setError("Verification failed. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  function handleCodeChange(index: number, value: string) {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(0, 1)
    
    const newCode = [...code]
    newCode[index] = digit
    setCode(newCode)

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Clear error when user types
    if (error) setError(null)
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    // Move to previous input on backspace if current is empty
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }

    // Allow paste
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      // Let paste happen naturally
      return
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, index: number) {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    const newCode = [...code]
    
    for (let i = 0; i < pastedData.length; i++) {
      if (index + i < 6) {
        newCode[index + i] = pastedData[i]
      }
    }
    
    setCode(newCode)
    
    // Focus the next empty input or the last filled one
    const nextEmptyIndex = newCode.findIndex((digit) => digit === "")
    if (nextEmptyIndex !== -1) {
      inputRefs.current[nextEmptyIndex]?.focus()
    } else {
      inputRefs.current[5]?.focus()
    }
  }

  // Close modal on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && showModal && !submitting) {
        setShowModal(false)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showModal, submitting])

  // Focus first input when modal opens
  useEffect(() => {
    if (showModal) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    }
  }, [showModal])

  return (
    <>
      <Button
        variant={variant}
        disabled={disabled}
        onClick={handleTriggerClick}
      >
        {children}
      </Button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => {
              if (!submitting) setShowModal(false)
            }}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-200/50 dark:border-white/10 bg-white/95 dark:bg-[#13132b]/95 backdrop-blur-xl p-8 shadow-2xl shadow-[#6c63ff]/5 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-6">
              {/* Header */}
              <div className="space-y-2 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#6c63ff]/10 mx-auto">
                  <svg className="w-7 h-7 text-[#6c63ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Confirm Identity
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enter your 6-digit authenticator code to continue.
                </p>
              </div>

              {/* Action being performed */}
              <div className="rounded-xl bg-gray-50/80 dark:bg-white/5 border border-gray-200/50 dark:border-white/10 p-4">
                <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Action:
                </p>
                <p className="text-sm font-semibold text-gray-800 dark:text-white mt-1">
                  {actionDescription}
                </p>
              </div>

              {locked ? (
                <div className="rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/30 p-4 text-center">
                  <svg className="w-6 h-6 text-red-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">Account Locked</p>
                  <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">Contact support for assistance.</p>
                </div>
              ) : (
                <form onSubmit={handleVerify} className="space-y-5">
                  <div className="space-y-3">
                    <Label className="text-xs font-medium text-gray-600 dark:text-gray-400 text-center block">
                      Enter verification code
                    </Label>
                    
                    {/* OTP Input Boxes */}
                    <div className="flex justify-center gap-2">
                      {code.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => { inputRefs.current[index] = el }}
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleCodeChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          onPaste={(e) => handlePaste(e, index)}
                          className={`w-12 h-14 text-center text-2xl font-bold font-mono rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#6c63ff]/20 ${
                            digit
                              ? "border-[#6c63ff]/60 bg-[#6c63ff]/5 dark:bg-[#6c63ff]/10"
                              : error
                              ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10"
                              : "border-gray-200 dark:border-white/10 bg-white dark:bg-transparent hover:border-gray-300 dark:hover:border-white/20"
                          }`}
                          disabled={submitting}
                          aria-label={`Digit ${index + 1} of 6`}
                        />
                      ))}
                    </div>

                    {/* Error message */}
                    {error && (
                      <div className="flex items-center justify-center gap-2 text-sm text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-top-2 duration-200">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-xl border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-200"
                      onClick={() => setShowModal(false)}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40 disabled:opacity-50"
                      disabled={submitting || code.some((d) => d === "")}
                    >
                      {submitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                          </svg>
                          Verifying...
                        </span>
                      ) : (
                        "Confirm"
                      )}
                    </Button>
                  </div>
                </form>
              )}

              {/* Footer note */}
              {!locked && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    This action requires additional verification
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
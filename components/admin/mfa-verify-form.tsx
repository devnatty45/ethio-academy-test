// components/admin/mfa-verify-form.tsx
// Redesigned MFA verification form with GitHub-style OTP input

"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { UserRole } from "@/types/database"

interface MfaVerifyFormProps {
  userRole: UserRole
}

export default function MfaVerifyForm({ userRole }: MfaVerifyFormProps) {
  const router = useRouter()
  const [code, setCode] = useState<string[]>(Array(6).fill(""))
  const [backupCode, setBackupCode] = useState("")
  const [isBackupCode, setIsBackupCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [locked, setLocked] = useState(false)
  const [minutesLeft, setMinutesLeft] = useState(0)
  const [allCodesExhausted, setAllCodesExhausted] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const backupInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on mount
  useEffect(() => {
    if (!isBackupCode) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    } else {
      setTimeout(() => backupInputRef.current?.focus(), 100)
    }
  }, [isBackupCode])

  // Countdown timer for lockout
  useEffect(() => {
    if (locked && minutesLeft > 0) {
      const timer = setInterval(() => {
        setMinutesLeft((prev) => {
          if (prev <= 1) {
            setLocked(false)
            setCountdown(null)
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 60000)
      return () => clearInterval(timer)
    }
  }, [locked, minutesLeft])

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const fullCode = isBackupCode ? backupCode.trim() : code.join("")
    
    if (!isBackupCode && fullCode.length !== 6) {
      setError("Please enter all 6 digits")
      setSubmitting(false)
      return
    }

    if (isBackupCode && fullCode.length !== 10) {
      setError("Backup code must be 10 characters")
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch("/api/admin/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: fullCode, isBackupCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 423) {
          setLocked(true)
          setMinutesLeft(data.minutesLeft ?? 30)
          setCountdown(data.minutesLeft ?? 30)
        }
        if (data.allCodesExhausted) {
          setAllCodesExhausted(true)
        }
        setError(data.error ?? "Verification failed.")
        if (!isBackupCode) {
          setCode(Array(6).fill(""))
          inputRefs.current[0]?.focus()
        } else {
          setBackupCode("")
          backupInputRef.current?.focus()
        }
        return
      }

      // Backup code used — must re-setup MFA immediately
      if (data.requiresMfaResetup) {
        router.push("/dashboard/admin/mfa-setup")
        router.refresh()
        return
      }

      // Verified — go to dashboard
      if (userRole === "BRANCH_ADMIN") {
        router.push("/dashboard/branch")
      } else {
        router.push("/dashboard/master")
      }
      router.refresh()
    } catch {
      setError("Verification failed. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (locked) {
    return (
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-red-50/80 to-red-50/30 dark:from-red-900/20 dark:to-red-900/5 border border-red-200/50 dark:border-red-800/30 p-6 text-center">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-red-500/10 rounded-full blur-2xl" />
          
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">
              Account Locked
            </h3>
            <p className="text-sm text-red-600/80 dark:text-red-400/80 leading-relaxed">
              Too many failed attempts. Your account is locked for{" "}
              <span className="font-bold">{minutesLeft}</span> minute{minutesLeft === 1 ? "" : "s"}.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <svg className="animate-pulse w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-red-500/80 dark:text-red-400/80">
                Lockout expires in {minutesLeft}m
              </span>
            </div>
            <p className="text-xs text-red-500/60 dark:text-red-400/60 mt-3">
              Contact your administrator if you need immediate access.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (allCodesExhausted) {
    return (
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-red-50/80 to-red-50/30 dark:from-red-900/20 dark:to-red-900/5 border border-red-200/50 dark:border-red-800/30 p-6 text-center">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />
          
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">
              All Backup Codes Used
            </h3>
            <p className="text-sm text-red-600/80 dark:text-red-400/80 leading-relaxed">
              All 8 backup codes have been used. Contact the Master Admin
              to reset your MFA configuration.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Security badge */}
      <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/20">
        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
          {isBackupCode ? "Backup Code Required" : "Authenticator Verification"}
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20 animate-in fade-in slide-in-from-top-2 duration-300">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              Verification Failed
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isBackupCode ? "Backup Code" : "Authenticator Code"}
          </Label>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {isBackupCode ? "10 characters" : "6 digits"}
          </span>
        </div>
        
        {isBackupCode ? (
          // Backup Code Input - Single field
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <Input
              ref={backupInputRef}
              id="backup-code"
              value={backupCode}
              onChange={(e) => {
                const val = e.target.value.toUpperCase().replace(/[^A-F0-9]/g, "")
                if (val.length <= 10) setBackupCode(val)
                if (error) setError(null)
              }}
              placeholder="XXXXXXXXXX"
              maxLength={10}
              className="pl-9 text-center text-2xl font-mono tracking-[0.5em] rounded-xl border-2 border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 h-14 transition-all duration-200"
              autoFocus
              required
            />
          </div>
        ) : (
          // OTP Input Boxes - GitHub style
          <div className="space-y-3">
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

            {/* Code format hint with dots */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                Enter the 6-digit code from Google Authenticator
              </p>
              <div className="flex items-center gap-1.5">
                <div className="flex gap-1">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        i < code.filter(d => d !== "").length 
                          ? "bg-[#6c63ff] scale-100" 
                          : "bg-gray-200 dark:bg-white/10 scale-75"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Button
        type="submit"
        className="w-full bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white rounded-xl py-3.5 font-semibold transition-all duration-300 shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40 disabled:opacity-50 disabled:hover:shadow-lg"
        disabled={
          submitting ||
          (isBackupCode ? backupCode.length !== 10 : code.some((d) => d === ""))
        }
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
            {isBackupCode ? "Verify Backup Code" : "Verify & Continue"}
          </span>
        )}
      </Button>

      {/* Toggle between authenticator and backup code */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200/50 dark:border-white/10" />
        </div>
        <div className="relative flex justify-center">
          <button
            type="button"
            onClick={() => {
              setIsBackupCode(!isBackupCode)
              setCode(Array(6).fill(""))
              setBackupCode("")
              setError(null)
            }}
            className="px-4 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-[#6c63ff] dark:hover:text-[#9d97ff] bg-white dark:bg-[#13132b] transition-colors rounded-full hover:bg-gray-50 dark:hover:bg-white/5"
          >
            {isBackupCode ? "Use authenticator app instead" : "Use a backup code instead"}
          </button>
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Time-sensitive</span>
        </div>
        <div className="w-px h-3 bg-gray-200 dark:bg-white/10" />
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Secure</span>
        </div>
      </div>
    </form>
  )
}
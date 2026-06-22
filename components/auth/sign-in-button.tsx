// components/auth/sign-in-button.tsx
// Redesigned Google OAuth sign-in button with modern UI

"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function SignInButtonInner() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const [loading, setLoading] = useState(false)

  async function handleSignIn() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    // Note: The page will redirect, so we don't need to set loading false
  }

  return (
    <div className="space-y-4">
      {/* Error messages */}
      {error === "account_deactivated" && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20 animate-in fade-in slide-in-from-top-2 duration-300">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              Account Deactivated
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
              This account has been deactivated. Please contact the school for assistance.
            </p>
          </div>
        </div>
      )}
      
      {(error === "oauth_error" || error === "session_error") && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20 animate-in fade-in slide-in-from-top-2 duration-300">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              Sign-in Failed
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
              We couldn't sign you in. Please try again or contact support if the issue persists.
            </p>
          </div>
        </div>
      )}

      {/* Sign-in Button */}
      <Button
        onClick={handleSignIn}
        variant="outline"
        size="lg"
        disabled={loading}
        className="relative w-full h-14 rounded-xl border-2 border-gray-200 dark:border-white/10 bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-white/5 hover:border-[#6c63ff]/40 transition-all duration-300 shadow-sm hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed group"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-3">
            <svg className="animate-spin w-5 h-5 text-[#6c63ff]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
            </svg>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Redirecting to Google...
            </span>
          </span>
        ) : (
          <span className="flex items-center justify-center gap-3">
            {/* Google Icon */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-[#6c63ff] dark:group-hover:text-[#9d97ff] transition-colors">
              Sign in with Google
            </span>
            <svg 
              className="w-4 h-4 text-gray-400 group-hover:text-[#6c63ff] dark:group-hover:text-[#9d97ff] group-hover:translate-x-0.5 transition-all duration-300" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        )}
      </Button>

      {/* Divider or additional info */}
      <div className="flex items-center justify-center gap-3">
        <div className="flex-1 h-px bg-linear-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent" />
        <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Secure Access
        </span>
        <div className="flex-1 h-px bg-linear-to-l from-transparent via-gray-200 dark:via-white/10 to-transparent" />
      </div>

      {/* Trust indicators */}
      <div className="flex items-center justify-center gap-6">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">SSL Encrypted</span>
        </div>
        <div className="w-px h-3 bg-gray-200 dark:bg-white/10" />
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Google Verified</span>
        </div>
        <div className="w-px h-3 bg-gray-200 dark:bg-white/10" />
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Privacy Protected</span>
        </div>
      </div>
    </div>
  )
}

export default function SignInButton() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <Button 
          variant="outline" 
          size="lg" 
          className="w-full h-14 rounded-xl border-2 border-gray-200 dark:border-white/10 bg-white dark:bg-transparent opacity-60 cursor-not-allowed"
          disabled
        >
          <span className="flex items-center justify-center gap-3">
            <svg className="animate-pulse w-5 h-5 text-gray-400" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-sm font-medium text-gray-400 dark:text-gray-500">
              Loading...
            </span>
          </span>
        </Button>
      </div>
    }>
      <SignInButtonInner />
    </Suspense>
  )
}
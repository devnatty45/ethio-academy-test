// app/dashboard/admin/mfa-setup/page.tsx
// Redesigned MFA setup page with modern UI

import { requireRole, isAdminMfaConfigured, isMfaVerifiedInSession } from "@/lib/supabase/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import MfaSetupForm from "@/components/admin/mfa-setup-form"

export default async function MfaSetupPage() {
  const user = await requireRole("BRANCH_ADMIN", "MASTER_ADMIN")

  const mfaConfigured = await isAdminMfaConfigured(user.id)
  const sessionVerified = await isMfaVerifiedInSession(user.id)

  // MFA configured AND session verified — this is a re-setup after
  // backup code use. Allow through.
  // MFA configured AND session NOT verified — normal login flow,
  // go to verify page instead.
  if (mfaConfigured && !sessionVerified) {
    redirect("/dashboard/admin/mfa-verify")
  }

  // MFA configured AND session verified — re-setup after backup code
  // Fall through to show setup form

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f8f7ff] via-white to-[#f0eeff] dark:from-[#0a0a1a] dark:via-[#0d0d1a] dark:to-[#0f0f24] flex flex-col items-center justify-center p-8">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-[#6c63ff]/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#8b83ff]/5 rounded-full blur-3xl" />
      
      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-[#6c63ff] to-[#8b83ff] shadow-lg shadow-[#6c63ff]/25 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {mfaConfigured
              ? "Re-configure Two-Factor Authentication"
              : "Set Up Two-Factor Authentication"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {mfaConfigured
              ? "You used a backup code to sign in. You must set up a new authenticator before continuing."
              : "You must configure Google Authenticator before accessing your dashboard."}
          </p>
        </div>

        {/* Main Card */}
        <div className="relative">
          <div className="absolute -inset-1 bg-linear-to-r from-[#6c63ff]/20 via-transparent to-[#6c63ff]/20 rounded-3xl blur-xl opacity-30" />
          
          <div className="relative bg-white/80 dark:bg-[#13132b]/80 backdrop-blur-xl rounded-2xl border border-gray-100/50 dark:border-white/8 shadow-2xl shadow-[#6c63ff]/5 overflow-hidden">
            
            {/* Header accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[#6c63ff] via-[#8b83ff] to-[#6c63ff]" />
            
            {/* Content */}
            <div className="px-6 py-6">
              <MfaSetupForm userRole={user.role} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">Secure</span>
            </div>
            <div className="w-px h-3 bg-gray-200 dark:bg-white/10" />
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">Google Authenticator</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
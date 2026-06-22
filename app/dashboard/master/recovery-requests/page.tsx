// app/dashboard/master/recovery-requests/page.tsx
// Redesigned recovery requests page with modern UI

import {
  requireRole,
  isAdminMfaConfigured,
  requireMfaVerified,
} from "@/lib/supabase/session"
import { redirect } from "next/navigation"
import RecoveryRequestsClient from "@/components/admin/recovery-requests-client"

export default async function RecoveryRequestsPage() {
  const user = await requireRole("MASTER_ADMIN")

  const mfaConfigured = await isAdminMfaConfigured(user.id)
  if (!mfaConfigured) redirect("/dashboard/admin/mfa-setup")

  await requireMfaVerified(user.id)

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f8f7ff] via-white to-[#f0eeff] dark:from-[#0a0a1a] dark:via-[#0d0d1a] dark:to-[#0f0f24] px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-[#6c63ff]/20 to-[#8b83ff]/20 flex items-center justify-center border border-[#6c63ff]/20">
              <svg className="w-7 h-7 text-[#6c63ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                Guardian Recovery Requests
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Review guardians attempting to recover access to their student records.
                MFA is required for all approvals.
              </p>
            </div>
          </div>

          {/* Main Card */}
          <div className="relative">
            <div className="absolute -inset-1 bg-linear-to-r from-[#6c63ff]/20 via-transparent to-[#6c63ff]/20 rounded-3xl blur-xl opacity-30" />
            
            <div className="relative bg-white/80 dark:bg-[#13132b]/80 backdrop-blur-xl rounded-2xl border border-gray-100/50 dark:border-white/8 shadow-2xl shadow-[#6c63ff]/5 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[#6c63ff] via-[#8b83ff] to-[#6c63ff]" />
              
              <div className="px-6 py-6">
                <RecoveryRequestsClient />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
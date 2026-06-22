// app/dashboard/guardian/complete-profile/page.tsx
// Redesigned profile completion page with modern UI

import { requireRole } from "@/lib/supabase/session"
import { isGuardianProfileComplete } from "@/lib/utils/guardian"
import { redirect } from "next/navigation"
import Link from "next/link"
import ProfileCompletionForm from "@/components/guardian/profile-completion-form"

export default async function CompleteProfilePage() {
  const user = await requireRole("GUARDIAN")

  const isComplete = await isGuardianProfileComplete(user.id)
  if (isComplete) {
    redirect("/dashboard/guardian")
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f8f7ff] via-white to-[#f0eeff] dark:from-[#0a0a1a] dark:via-[#0d0d1a] dark:to-[#0f0f24] px-4 py-8 md:py-12">
      <div className="mx-auto max-w-2xl">
        {/* Back button */}
        <div className="mb-8">
          <Link 
            href="/dashboard/guardian"
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-[#6c63ff] dark:hover:text-[#9d97ff] transition-colors group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Main Card */}
        <div className="relative">
          <div className="absolute -inset-1 bg-linear-to-r from-[#6c63ff]/20 via-transparent to-[#6c63ff]/20 rounded-3xl blur-xl opacity-30" />
          
          <div className="relative bg-white/80 dark:bg-[#13132b]/80 backdrop-blur-xl rounded-2xl border border-gray-100/50 dark:border-white/8 shadow-2xl shadow-[#6c63ff]/5 overflow-hidden">
            
            {/* Header */}
            <div className="relative px-6 pt-8 pb-6 border-b border-gray-100/50 dark:border-white/5">
              <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[#6c63ff] via-[#8b83ff] to-[#6c63ff]" />
              
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-[#6c63ff]/20 to-[#8b83ff]/20 flex items-center justify-center shrink-0 border border-[#6c63ff]/20">
                  <svg className="w-7 h-7 text-[#6c63ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                    Complete Your Profile
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Your profile must be complete before you can enroll students.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200/50 dark:border-amber-800/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Required</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <ProfileCompletionForm userId={user.id} />
            </div>
          </div>
        </div>

        {/* Footer steps */}
        <div className="mt-8 flex justify-center gap-8">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#6c63ff]" />
            <span className="text-xs text-gray-400 dark:text-gray-500">Profile</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-200 dark:bg-white/10" />
            <span className="text-xs text-gray-400 dark:text-gray-500">Students</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-200 dark:bg-white/10" />
            <span className="text-xs text-gray-400 dark:text-gray-500">Enroll</span>
          </div>
        </div>
      </div>
    </div>
  )
}
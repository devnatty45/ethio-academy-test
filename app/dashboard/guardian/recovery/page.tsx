// app/dashboard/guardian/recovery/page.tsx
// Redesigned account recovery page with modern UI

import { requireRole } from "@/lib/supabase/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import RecoveryRequestForm from "@/components/guardian/recovery-request-form"

export default async function RecoveryPage() {
  const user = await requireRole("GUARDIAN")

  // Check if guardian already has linked students
  const adminClient = createAdminClient()
  const { count } = await adminClient
    .from("guardian_student_links")
    .select("id", { count: "exact", head: true })
    .eq("guardian_id", user.id)
    .eq("is_active", true)

  if ((count ?? 0) > 0) {
    redirect("/dashboard/guardian")
  }

  // Check for existing pending recovery request
  const { data: existingRequest } = await adminClient
    .from("guardian_recovery_requests")
    .select("id, status, confidence_level, created_at")
    .eq("new_guardian_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f8f7ff] via-white to-[#f0eeff] dark:from-[#0a0a1a] dark:via-[#0d0d1a] dark:to-[#0f0f24] px-4 py-8 md:py-12">
      <div className="mx-auto max-w-3xl">
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
                <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-amber-500/20 to-amber-600/20 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <svg className="w-7 h-7 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                    Account Recovery
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Lost access to your previous account? Submit a recovery request to transfer your student records.
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              {existingRequest && existingRequest.status === "PENDING" && (
                <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-amber-50/80 to-amber-50/30 dark:from-amber-900/20 dark:to-amber-900/5 border border-amber-200/50 dark:border-amber-800/30 p-4 mb-6">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
                  
                  <div className="relative flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                        Recovery Request Pending Review
                      </p>
                      <p className="text-xs text-amber-600/80 dark:text-amber-400/80 leading-relaxed mt-1">
                        Submitted {new Date(existingRequest.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}. 
                        Confidence: <span className="font-medium">{existingRequest.confidence_level}</span>
                      </p>
                      <p className="text-xs text-amber-600/60 dark:text-amber-400/60 mt-1">
                        An administrator will review your request shortly.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {existingRequest && existingRequest.status === "REJECTED" && (
                <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-red-50/80 to-red-50/30 dark:from-red-900/20 dark:to-red-900/5 border border-red-200/50 dark:border-red-800/30 p-4 mb-6">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />
                  
                  <div className="relative flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                        Request Rejected
                      </p>
                      <p className="text-xs text-red-600/80 dark:text-red-400/80 leading-relaxed mt-1">
                        Your previous recovery request was rejected. You may submit a new request or visit the school in person.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {existingRequest && existingRequest.status === "PHYSICAL_VISIT_REQUIRED" && (
                <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-gray-50/80 to-gray-50/30 dark:from-white/5 dark:to-white/3 border border-gray-200/50 dark:border-white/10 p-4 mb-6">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gray-500/10 rounded-full blur-2xl" />
                  
                  <div className="relative flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Physical Visit Required
                      </p>
                      <p className="text-xs text-gray-600/80 dark:text-gray-400/80 leading-relaxed mt-1">
                        Please visit the school in person with your original identification documents to complete account recovery.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {(!existingRequest || existingRequest.status !== "PENDING") && 
               existingRequest?.status !== "PHYSICAL_VISIT_REQUIRED" && (
                <RecoveryRequestForm />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
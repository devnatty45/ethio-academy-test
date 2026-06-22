// app/dashboard/guardian/students/[id]/page.tsx
// Redesigned Student profile page with modern UI

import { requireRole } from "@/lib/supabase/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import StudentProfileClient from "@/components/guardian/student-profile-client"

interface StudentPageProps {
  params: Promise<{ id: string }>
}

export default async function StudentProfilePage({
  params,
}: StudentPageProps) {
  const user = await requireRole("GUARDIAN")
  const { id: studentId } = await params

  const adminClient = createAdminClient()

  // Verify guardian is linked to this student
  const { data: link } = await adminClient
    .from("guardian_student_links")
    .select("id, link_type")
    .eq("guardian_id", user.id)
    .eq("student_id", studentId)
    .eq("is_active", true)
    .single()

  if (!link) {
    redirect("/dashboard/guardian")
  }

  // Fetch student details
  const { data: student } = await adminClient
    .from("students")
    .select("id, stu_id, full_name, date_of_birth, gender, status")
    .eq("id", studentId)
    .single()

  if (!student) {
    redirect("/dashboard/guardian")
  }

  // Fetch active co-guardian if exists
  const { data: activeCoGuardianLink } = await adminClient
    .from("guardian_student_links")
    .select(`
      id,
      users!guardian_id (full_name, email)
    `)
    .eq("student_id", studentId)
    .eq("link_type", "CO_GUARDIAN")
    .eq("is_active", true)
    .single()

  // Fetch pending invite if exists
  const { data: pendingInvite } = await adminClient
    .from("co_guardian_invites")
    .select("id, invited_phone, invite_token_expires_at, status")
    .eq("student_id", studentId)
    .eq("invited_by_guardian_id", user.id)
    .eq("status", "PENDING")
    .single()

  const isPrimary = link.link_type === "PRIMARY"

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
            
            {/* Header with gradient accent */}
            <div className="relative px-6 pt-8 pb-6 border-b border-gray-100/50 dark:border-white/5">
              <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[#6c63ff] via-[#8b83ff] to-[#6c63ff]" />
              
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-[#6c63ff]/20 to-[#8b83ff]/20 flex items-center justify-center shrink-0 border border-[#6c63ff]/20">
                  <span className="text-2xl font-bold text-[#6c63ff]">
                    {student.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                      {student.full_name}
                    </h1>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                      student.status === "ACTIVE" 
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30"
                        : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border border-gray-200/50 dark:border-white/10"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        student.status === "ACTIVE" ? "bg-emerald-500" : "bg-gray-400"
                      }`} />
                      {student.status || "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded">
                      STU {student.stu_id}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {isPrimary ? "Primary Guardian" : "Co-Guardian"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-6">
              {/* Student Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Student Information</h3>
                  <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-[#6c63ff]/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#6c63ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Full Name</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">{student.full_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-[#6c63ff]/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#6c63ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Date of Birth</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">
                        {new Date(student.date_of_birth).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-[#6c63ff]/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#6c63ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Gender</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white capitalize">{student.gender?.toLowerCase() || "Not specified"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-[#6c63ff]/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#6c63ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Your Role</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">
                        {isPrimary ? "Primary Guardian" : "Co-Guardian"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100/50 dark:border-white/5" />

              {/* Co-Guardian Management */}
              <StudentProfileClient
                studentId={studentId}
                isPrimary={isPrimary}
                activeCoGuardian={
                  activeCoGuardianLink
                    ? {
                        id: activeCoGuardianLink.id,
                        user: Array.isArray(activeCoGuardianLink.users)
                          ? activeCoGuardianLink.users[0] ?? null
                          : activeCoGuardianLink.users,
                      }
                    : null
                }
                pendingInvite={
                  pendingInvite
                    ? {
                        id: pendingInvite.id,
                        invitedPhone: pendingInvite.invited_phone,
                        expiresAt: pendingInvite.invite_token_expires_at,
                      }
                    : null
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
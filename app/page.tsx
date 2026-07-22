// app/page.tsx
// Public landing page — unauthenticated entry point
// Accessible to: everyone
// Authenticated users are redirected to their role-appropriate dashboard
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import SignInButton from "@/components/auth/sign-in-button"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/auth/route-to-dashboard")
  }

  return (
    <main className="min-h-screen bg-[#0a0d2e] flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background orbs */}
      <div className="absolute -top-30 -right-30 w-100 h-100 rounded-full bg-[#6c63ff] opacity-10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-75 h-75 rounded-full bg-[#f5a623] opacity-10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 w-50 h-50 rounded-full bg-[#4ecdc4] opacity-5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl border border-white/10">

        {/* ── LEFT PANEL ── */}
        <div className="bg-[#0f1246] px-10 py-12 flex flex-col justify-between gap-12 relative overflow-hidden">

          {/* Inner decorative orbs */}
          <div className="absolute -top-15 -right-15 w-55 h-55 rounded-full bg-[#6c63ff] opacity-15 blur-2xl pointer-events-none" />
          <div className="absolute bottom-10 -left-10 w-40 h-40 rounded-full bg-[#f5a623] opacity-10 blur-2xl pointer-events-none" />

          {/* Badge */}
          <div className="w-fit flex items-center gap-2 bg-[#f5a623]/15 border border-[#f5a623]/30 rounded-full px-4 py-1.5 text-[#f5a623] text-xs font-semibold tracking-widest uppercase">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Enrollment Portal
          </div>

          {/* Main copy */}
          <div className="flex flex-col gap-5">
            <div className="w-14 h-14 bg-linear-to-br from-[#f5a623] to-[#e8892a] rounded-2xl flex items-center justify-center text-2xl shadow-lg">
              🏫
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white leading-tight tracking-tight">
                Every student's<br />journey starts here.
              </h1>
              <p className="mt-3 text-sm text-white/50 leading-relaxed max-w-xs">
                A unified portal for enrollment, course management, and school communication — built for the whole community.
              </p>
            </div>

            {/* Role pills */}
            <div className="flex flex-wrap gap-2 mt-1">
              {[
                { label: "Students", icon: "👨‍🎓" },
                { label: "Parents", icon: "👨‍👩‍👧" },
                { label: "Admins", icon: "🛡️" },
              ].map((r) => (
                <div
                  key={r.label}
                  className="flex items-center gap-2 bg-white/7 border border-white/12 rounded-full px-4 py-1.5 text-sm text-white/70 font-medium"
                >
                  <span>{r.icon}</span>
                  {r.label}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs text-white/25">
            © {new Date().getFullYear()} School Registration System
          </p>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="bg-white dark:bg-[#111827] px-10 py-12 flex flex-col justify-center gap-7">

          {/* Heading */}
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-[#6c63ff] mb-2">
              Welcome back
            </p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Sign in to your portal
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              Use your school-issued Google account to continue.
            </p>
          </div>

          {/* Role chips */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Students", icon: "🎓" },
              { label: "Parents", icon: "🏠" },
              { label: "Admins", icon: "⚙️" },
            ].map((r) => (
              <div
                key={r.label}
                className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 text-xs font-medium text-gray-500 dark:text-gray-400"
              >
                <span className="text-xl">{r.icon}</span>
                {r.label}
              </div>
            ))}
          </div>

          {/* Sign-in button — YOUR COMPONENT, UNTOUCHED */}
          <SignInButton />

          {/* Teacher signup entry point */}
<div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
  <span>Are you a teacher?</span>
  
    href="/auth/teacher-signin"
    className="font-semibold text-[#6c63ff] hover:text-[#5750d9] transition-colors"
  &gt;
    Sign up as Teacher
  </a>
</div>

          {/* Notice */}
          <div className="flex items-start gap-3 bg-[#6c63ff]/5 border border-[#6c63ff]/15 rounded-xl px-4 py-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Only <span className="font-semibold text-gray-700 dark:text-gray-300">Google accounts</span> are accepted. Contact the school administration if you need assistance.
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-100 dark:bg-white/10" />
            <span className="text-xs text-gray-400 dark:text-gray-500">Redirects based on your role</span>
            <div className="h-px flex-1 bg-gray-100 dark:bg-white/10" />
          </div>

          {/* Security note */}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Secured with Google OAuth 2.0
          </div>

        </div>
      </div>
    </main>
  )
}

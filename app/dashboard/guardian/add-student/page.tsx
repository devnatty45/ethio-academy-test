// app/dashboard/guardian/add-student/page.tsx
// Add student page — guardian only
// Shows fuzzy match results before allowing creation
import { requireRole } from "@/lib/supabase/session"
import { isGuardianProfileComplete } from "@/lib/utils/guardian"
import { redirect } from "next/navigation"
import AddStudentFlow from "@/components/guardian/add-student-flow"

export default async function AddStudentPage() {
  const user = await requireRole("GUARDIAN")
  const profileComplete = await isGuardianProfileComplete(user.id)

  if (!profileComplete) {
    redirect("/dashboard/guardian/complete-profile")
  }

  return (
    <div className="min-h-screen bg-[#f8f7ff] dark:bg-[#0d0d1a] px-4 py-10">
      <div className="mx-auto max-w-lg space-y-8">

        {/* Header */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-[#6c63ff] mb-2">
            Guardian Portal
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Add a Student
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
            Enter the student's details below. The system will check for
            an existing record before creating a new profile.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {["Enter Details", "Review Records", "Confirm"].map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i === 0
                    ? "bg-[#6c63ff] text-white"
                    : "bg-gray-100 dark:bg-white/8 text-gray-400 dark:text-gray-600"
                }`}>
                  {i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${
                  i === 0 ? "text-[#6c63ff]" : "text-gray-400 dark:text-gray-600"
                }`}>
                  {label}
                </span>
              </div>
              {i < 2 && (
                <div className="flex-1 h-px bg-gray-100 dark:bg-white/8 ml-1" />
              )}
            </div>
          ))}
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-gray-100 dark:border-white/8 bg-white dark:bg-[#13132b] shadow-sm p-6 sm:p-8">
          <AddStudentFlow />
        </div>

      </div>
    </div>
  )
}
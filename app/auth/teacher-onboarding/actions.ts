// app/auth/teacher-onboarding/actions.ts
// Purpose: Server action to create a teacher_profiles row after onboarding form submit
"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"

export async function submitTeacherOnboarding(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  const fullName = (formData.get("full_name") as string)?.trim()
  const phone = (formData.get("phone") as string)?.trim()
  const branchId = formData.get("branch_id") as string

  if (!fullName || !phone || !branchId) {
    redirect("/auth/teacher-onboarding?error=missing_fields")
  }

  const adminClient = createAdminClient()

  // Confirm this user is actually a TEACHER role — defense in depth,
  // in case someone hits this action directly without going through the flow
  const { data: userData } = await adminClient
    .from("users")
    .select("role")
    .eq("id", user!.id)
    .single()

  if (!userData || userData.role !== "TEACHER") {
    redirect("/auth/route-to-dashboard")
  }

  // Prevent duplicate onboarding submissions
  const { data: existingProfile } = await adminClient
    .from("teacher_profiles")
    .select("id")
    .eq("user_id", user!.id)
    .single()

  if (existingProfile) {
    redirect("/dashboard/teacher")
  }

  const { error } = await adminClient.from("teacher_profiles").insert({
    user_id: user!.id,
    branch_id: branchId,
    full_name: fullName,
    phone: phone,
    status: "PENDING_APPROVAL",
  })

  if (error) {
    redirect("/auth/teacher-onboarding?error=submit_failed")
  }

  redirect("/dashboard/teacher")
}

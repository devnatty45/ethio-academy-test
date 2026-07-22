// app/auth/route-to-dashboard/route.ts
// Purpose: Read user role from DB and redirect to correct dashboard
// Who can call it: authenticated users only
// Called after OAuth callback and after any login
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  const cookieStore = await cookies()

  // Check for pending co-guardian invite token
  const pendingInviteToken = cookieStore.get("pending_invite_token")?.value
  if (pendingInviteToken) {
    cookieStore.delete("pending_invite_token")
    return NextResponse.redirect(
      new URL(`/invite/co-guardian?token=${pendingInviteToken}`, request.url)
    )
  }

  // Check for pending teacher signup intent
  const pendingSignupRole = cookieStore.get("pending_signup_role")?.value

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient
    .from("users")
    .select("role, status")
    .eq("id", user.id)
    .single()

  if (!userData) {
    // No users row yet — this is a first-time sign-in.
    // Only GUARDIAN or TEACHER are ever allowed here; anything else is ignored.
    const roleToCreate = pendingSignupRole === "TEACHER" ? "TEACHER" : "GUARDIAN"

    await adminClient.from("users").insert({
      id: user.id,
      email: user.email ?? "",
      full_name: user.user_metadata?.full_name ?? null,
      role: roleToCreate,
      status: "ACTIVE",
    })

    if (roleToCreate === "TEACHER") {
      cookieStore.delete("pending_signup_role")
      return NextResponse.redirect(
        new URL("/auth/teacher-onboarding", request.url)
      )
    }

    return NextResponse.redirect(new URL("/dashboard/guardian", request.url))
  }

  // Existing user — clear any stale signup-intent cookie, it's irrelevant now
  if (pendingSignupRole) {
    cookieStore.delete("pending_signup_role")
  }

  if (userData.status === "DEACTIVATED") {
    await supabase.auth.signOut()
    return NextResponse.redirect(
      new URL("/?error=account_deactivated", request.url)
    )
  }

  switch (userData.role) {
    case "GUARDIAN":
      return NextResponse.redirect(new URL("/dashboard/guardian", request.url))
    case "BRANCH_ADMIN":
      return NextResponse.redirect(new URL("/dashboard/branch", request.url))
    case "MASTER_ADMIN":
      return NextResponse.redirect(new URL("/dashboard/master", request.url))
    case "TEACHER": {
      // Check whether they've completed onboarding (teacher_profiles row exists)
      const { data: teacherProfile } = await adminClient
        .from("teacher_profiles")
        .select("status")
        .eq("user_id", user.id)
        .single()

      if (!teacherProfile) {
        return NextResponse.redirect(
          new URL("/auth/teacher-onboarding", request.url)
        )
      }

      return NextResponse.redirect(new URL("/dashboard/teacher", request.url))
    }
    default:
      return NextResponse.redirect(new URL("/", request.url))
  }
}

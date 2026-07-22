// app/auth/callback/route.ts
// Purpose: OAuth callback handler — exchanges code for session cookie,
// and corrects role to TEACHER if this was a teacher signup intent.
// Who can call it: Supabase Auth redirect only
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=oauth_error`)
  }

  const supabase = await createClient()
  const { error, data } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/?error=session_error`)
  }

  const cookieStore = await cookies()
  const pendingSignupRole = cookieStore.get("pending_signup_role")?.value

  if (pendingSignupRole === "TEACHER") {
    const adminClient = createAdminClient()
    const user = data.user

    // Only ever flip GUARDIAN -> TEACHER, and only for a genuinely
    // fresh signup that hasn't touched anything guardian-related yet.
    // This is the guardrail: an established account can never be
    // hijacked into TEACHER just by visiting the teacher-signin link.
    const { data: userRow } = await adminClient
      .from("users")
      .select("role, created_at")
      .eq("id", user.id)
      .single()

    const isFreshSignup =
      userRow &&
      new Date(userRow.created_at).getTime() > Date.now() - 2 * 60 * 1000 // created within last 2 min

    if (userRow?.role === "GUARDIAN" && isFreshSignup) {
      const { data: guardianProfile } = await adminClient
        .from("guardian_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()

      // No guardian_profiles row means they haven't done anything
      // as a guardian yet — safe to correct the role.
      if (!guardianProfile) {
        await adminClient
          .from("users")
          .update({ role: "TEACHER" })
          .eq("id", user.id)
      }
    }

    cookieStore.delete("pending_signup_role")
  }

  return NextResponse.redirect(`${origin}/auth/route-to-dashboard`)
}

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

  // Check for pending co-guardian invite token
  const cookieStore = await cookies()
  const pendingInviteToken = cookieStore.get("pending_invite_token")?.value

  if (pendingInviteToken) {
    // Clear the cookie
    cookieStore.delete("pending_invite_token")
    // Redirect to invite page with token
    return NextResponse.redirect(
      new URL(
        `/invite/co-guardian?token=${pendingInviteToken}`,
        request.url
      )
    )
  }

  // Normal role-based routing
  const adminClient = createAdminClient()
  const { data: userData } = await adminClient
    .from("users")
    .select("role, status")
    .eq("id", user.id)
    .single()

  if (!userData) {
    await adminClient.from("users").insert({
      id: user.id,
      email: user.email ?? "",
      full_name: user.user_metadata?.full_name ?? null,
      role: "GUARDIAN",
      status: "ACTIVE",
    })
    return NextResponse.redirect(
      new URL("/dashboard/guardian", request.url)
    )
  }

  if (userData.status === "DEACTIVATED") {
    await supabase.auth.signOut()
    return NextResponse.redirect(
      new URL("/?error=account_deactivated", request.url)
    )
  }

  switch (userData.role) {
    case "GUARDIAN":
      return NextResponse.redirect(
        new URL("/dashboard/guardian", request.url)
      )
    case "BRANCH_ADMIN":
      return NextResponse.redirect(
        new URL("/dashboard/branch", request.url)
      )
    case "MASTER_ADMIN":
      return NextResponse.redirect(
        new URL("/dashboard/master", request.url)
      )
    default:
      return NextResponse.redirect(new URL("/", request.url))
  }
}
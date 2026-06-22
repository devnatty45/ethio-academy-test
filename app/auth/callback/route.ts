// app/auth/callback/route.ts
// Purpose: OAuth callback handler — exchanges code for session cookie
// Who can call it: Supabase Auth redirect only
// Called automatically after Google OAuth completes

import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=oauth_error`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/?error=session_error`)
  }

  // Session established — route to correct dashboard based on role
  return NextResponse.redirect(`${origin}/auth/route-to-dashboard`)
}
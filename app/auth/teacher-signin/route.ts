// app/auth/teacher-signin/route.ts — NEW FILE
// Purpose: Set teacher signup intent cookie, then start Google OAuth
// Who can call it: unauthenticated users clicking "Sign up as Teacher"

import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  cookieStore.set("pending_signup_role", "TEACHER", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes — just long enough for the OAuth round trip
    path: "/",
  })

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${request.nextUrl.origin}/auth/callback`,
    },
  })

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/?error=oauth_error", request.url))
  }

  return NextResponse.redirect(data.url)
}

// app/api/auth/signout/route.ts
// Purpose: Sign out the current user, clear all session cookies
// Who can call it: any authenticated user

import { createClient } from "@/lib/supabase/server"
import {
  clearMfaVerifiedCookie,
  clearSensitiveActionVerifiedCookie,
} from "@/lib/supabase/session"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    await clearMfaVerifiedCookie(user.id)
    await clearSensitiveActionVerifiedCookie(user.id)
  }

  await supabase.auth.signOut()
  return NextResponse.redirect(new URL("/", request.url))
}

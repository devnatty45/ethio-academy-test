// app/api/auth/mobile-google/route.ts
// Purpose: Mobile Native Google Auth Handler — validates id_token & enforces Gatekeeper role check
// Who can call it: Guardian Mobile App only

import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { id_token } = await request.json()

    if (!id_token) {
      return NextResponse.json({ message: "Missing identity token" }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Log into Supabase using the ID Token supplied by the physical phone
    const { data: { session }, error: authError } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: id_token,
    })

    if (authError || !session) {
      return NextResponse.json({ message: authError?.message || "Authentication failed" }, { status: 401 })
    }

    // 2. Fetch the user's role from your profiles/roles table
    // (Replace 'profiles' and 'role' with your exact database table/column fields)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ message: "User profile not found" }, { status: 404 })
    }

    const userRole = profile.role // Expected values: MASTER_ADMIN, BRANCH_ADMIN, GUARDIAN

    // 3. THE NATIVE GATEKEEPER CONSTRAINT: Instantly reject admins on mobile
    if (userRole === 'MASTER_ADMIN' || userRole === 'BRANCH_ADMIN') {
      // Sign them out of Supabase immediately so the session doesn't linger active
      await supabase.auth.signOut()
      return NextResponse.json({ role: userRole, message: "ADMIN_BLOCKED" }, { status: 403 })
    }

    // 4. Success path: Return role and access token back to Flutter cleanly
    return NextResponse.json({
      role: userRole,
      session_token: session.access_token,
    }, { status: 200 })

  } catch (error) {
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 })
  }
}

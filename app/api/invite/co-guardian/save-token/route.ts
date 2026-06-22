// app/api/invite/co-guardian/save-token/route.ts
// Purpose: Save invite token to cookie and redirect to sign-in
// Called when unauthenticated user visits the invite page

import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token = searchParams.get("token")

  if (!token || token.length !== 64) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  const response = NextResponse.redirect(new URL("/", request.url))

  response.cookies.set("pending_invite_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_ENV === "production",
    maxAge: 60 * 60, // 1 hour
    path: "/",
  })

  return response
}
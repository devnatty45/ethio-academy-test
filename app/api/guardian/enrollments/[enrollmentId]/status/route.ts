// app/api/guardian/enrollments/[enrollmentId]/status/route.ts
// Purpose: Lightweight status check, used for polling after payment return
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const paramsSchema = z.object({ enrollmentId: z.string().uuid() })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select("status")
    .eq("id", paramsResult.data.enrollmentId)
    .eq("guardian_id", user.id)
    .single()

  if (!enrollment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ status: enrollment.status })
}
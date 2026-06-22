// app/api/master/recovery-requests/[requestId]/id-photo/route.ts
// Purpose: Return a signed Cloudinary URL for a national ID photo
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { generateSignedViewUrl } from "@/lib/cloudinary/server"

const paramsSchema = z.object({ requestId: z.string().uuid() })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!userData || userData.role !== "MASTER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { requestId } = paramsResult.data
  const { searchParams } = new URL(request.url)
  const side = searchParams.get("side") as "front" | "back" | null

  if (!side || !["front", "back"].includes(side)) {
    return NextResponse.json(
      { error: "side must be front or back" },
      { status: 400 }
    )
  }

  const { data: recoveryRequest } = await adminClient
    .from("guardian_recovery_requests")
    .select(
      "national_id_front_public_id, national_id_back_public_id"
    )
    .eq("id", requestId)
    .single()

  if (!recoveryRequest) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const publicId =
    side === "front"
      ? recoveryRequest.national_id_front_public_id
      : recoveryRequest.national_id_back_public_id

  const signedUrl = generateSignedViewUrl(publicId)
  return NextResponse.json({ url: signedUrl })
}
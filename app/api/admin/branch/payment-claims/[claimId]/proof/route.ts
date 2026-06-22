// app/api/admin/branch/payment-claims/[claimId]/proof/route.ts
// Purpose: Return a signed Cloudinary URL for a payment claim's proof document
// Who can call it: BRANCH_ADMIN for own branch, MASTER_ADMIN for any

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateSignedViewUrl } from "@/lib/cloudinary/server"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const paramsSchema = z.object({ claimId: z.string().uuid() })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
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

  if (
    !userData ||
    !["BRANCH_ADMIN", "MASTER_ADMIN"].includes(userData.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { data: claim } = await adminClient
    .from("manual_payment_claims")
    .select("proof_document_public_id, branch_id")
    .eq("id", paramsResult.data.claimId)
    .single()

  if (!claim) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (userData.role === "BRANCH_ADMIN") {
    const { data: adminProfile } = await adminClient
      .from("admin_profiles")
      .select("assigned_branch_id")
      .eq("user_id", user.id)
      .single()

    if (adminProfile?.assigned_branch_id !== claim.branch_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const signedUrl = generateSignedViewUrl(claim.proof_document_public_id)
  return NextResponse.json({ url: signedUrl })
}
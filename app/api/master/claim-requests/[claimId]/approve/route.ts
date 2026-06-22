// app/api/master/claim-requests/[claimId]/approve/route.ts
// Purpose: Approve a student claim — creates guardian_student_links record
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"
import { queueSms } from "@/lib/utils/sms"

const paramsSchema = z.object({ claimId: z.string().uuid() })

const approveSchema = z.object({
  linkType: z.enum(["PRIMARY", "CO_GUARDIAN"]).default("PRIMARY"),
})

export async function POST(
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

  if (!userData || userData.role !== "MASTER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const mfaVerified = await isMfaVerifiedInSession(user.id)
  if (!mfaVerified) {
    return NextResponse.json(
      { error: "MFA verification required" },
      { status: 403 }
    )
  }

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { claimId } = paramsResult.data

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    // No body is fine — defaults apply
  }

  const parsed = approveSchema.safeParse(body)
  const linkType = parsed.success ? parsed.data.linkType : "PRIMARY"

  const { data: claim, error: claimError } = await adminClient
    .from("claim_requests")
    .select(
      "id, status, claimed_guardian_id, matched_student_id, confidence_score"
    )
    .eq("id", claimId)
    .single()

  if (claimError || !claim) {
    return NextResponse.json(
      { error: "Claim not found" },
      { status: 404 }
    )
  }

  if (claim.status !== "PENDING") {
    return NextResponse.json(
      {
        error: `Cannot approve — claim is already ${claim.status}`,
      },
      { status: 409 }
    )
  }

  // Check if link already exists
  const { data: existingLink } = await adminClient
    .from("guardian_student_links")
    .select("id, is_active")
    .eq("guardian_id", claim.claimed_guardian_id)
    .eq("student_id", claim.matched_student_id)
    .single()

  if (existingLink) {
    if (existingLink.is_active) {
      // Already linked and active — just mark claim approved
      await adminClient
        .from("claim_requests")
        .update({
          status: "APPROVED",
          reviewed_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", claimId)

      return NextResponse.json({
        success: true,
        note: "Guardian was already linked to this student — claim marked approved",
      })
    } else {
      // Link exists but inactive — reactivate it
      const { error: reactivateError } = await adminClient
        .from("guardian_student_links")
        .update({
          is_active: true,
          link_type: linkType,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingLink.id)

      if (reactivateError) {
        console.error(
          "[ClaimApprove] Reactivate error:",
          reactivateError
        )
        return NextResponse.json(
          { error: "Could not reactivate student link" },
          { status: 500 }
        )
      }
    }
  } else {
    // No existing link — create one
    const { error: insertError } = await adminClient
      .from("guardian_student_links")
      .insert({
        guardian_id: claim.claimed_guardian_id,
        student_id: claim.matched_student_id,
        link_type: linkType,
        is_active: true,
      })

    if (insertError) {
      console.error("[ClaimApprove] Link insert error:", insertError)
      return NextResponse.json(
        {
          error: `Could not create student link: ${insertError.message}`,
        },
        { status: 500 }
      )
    }
  }

  // Mark claim as APPROVED
  const { error: updateError } = await adminClient
    .from("claim_requests")
    .update({
      status: "APPROVED",
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", claimId)

  if (updateError) {
    console.error("[ClaimApprove] Status update error:", updateError)
    return NextResponse.json(
      { error: "Could not update claim status" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: user.id,
    actorRole: "MASTER_ADMIN",
    actionType: "CLAIM_REQUEST_APPROVED",
    targetTable: "claim_requests",
    targetId: claimId,
    oldValue: { status: "PENDING" },
    newValue: {
      status: "APPROVED",
      guardian_id: claim.claimed_guardian_id,
      student_id: claim.matched_student_id,
      link_type: linkType,
      confidence_score: claim.confidence_score,
    },
  })

  // SMS to guardian
  const { data: guardianProfile } = await adminClient
    .from("guardian_profiles")
    .select("phone")
    .eq("user_id", claim.claimed_guardian_id)
    .single()

  if (guardianProfile?.phone) {
    await queueSms({
      recipientPhone: guardianProfile.phone,
      messageBody:
        "Your student claim request has been approved. You can now view and manage this student's enrollment.",
      triggerEvent: "CLAIM_APPROVED",
      relatedId: claimId,
    })
  }

  return NextResponse.json({
    success: true,
    linkType,
    guardianId: claim.claimed_guardian_id,
    studentId: claim.matched_student_id,
  })
}
// app/api/master/recovery-requests/[requestId]/approve/route.ts
// Purpose: Approve a guardian recovery request
// Transfers matched guardian's student links to the new account
// Deactivates old account by setting status = DEACTIVATED
// MFA re-verification required
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"
import { queueSms } from "@/lib/utils/sms"

const paramsSchema = z.object({ requestId: z.string().uuid() })

export async function POST(
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

  const { requestId } = paramsResult.data

  const { data: recoveryRequest, error: requestFetchError } =
    await adminClient
      .from("guardian_recovery_requests")
      .select(
        "id, status, new_guardian_id, matched_guardian_id, claimed_phone"
      )
      .eq("id", requestId)
      .single()

  if (requestFetchError || !recoveryRequest) {
    console.error("[RecoveryApprove] Request fetch error:", requestFetchError)
    return NextResponse.json(
      { error: "Request not found" },
      { status: 404 }
    )
  }

  if (recoveryRequest.status !== "PENDING") {
    return NextResponse.json(
      {
        error: `Cannot approve — request is already ${recoveryRequest.status}`,
      },
      { status: 409 }
    )
  }

  if (!recoveryRequest.matched_guardian_id) {
    return NextResponse.json(
      {
        error:
          "No matched guardian on this request — cannot approve without a match",
      },
      { status: 409 }
    )
  }

  // Step 1: Fetch all active student links from the old (matched) guardian
  const { data: existingLinks, error: linksError } = await adminClient
    .from("guardian_student_links")
    .select("id, student_id, link_type")
    .eq("guardian_id", recoveryRequest.matched_guardian_id)
    .eq("is_active", true)

  if (linksError) {
    console.error("[RecoveryApprove] Links fetch error:", linksError)
    return NextResponse.json(
      { error: "Could not fetch student links" },
      { status: 500 }
    )
  }

  console.log(
    "[RecoveryApprove] Found links to transfer:",
    existingLinks?.length ?? 0
  )

  // Step 2: Transfer each link to the new guardian
  let linksTransferred = 0
  for (const link of existingLinks ?? []) {
    // Check if a link already exists for the new guardian + this student
    const { data: existingNewLink } = await adminClient
      .from("guardian_student_links")
      .select("id, is_active")
      .eq("guardian_id", recoveryRequest.new_guardian_id)
      .eq("student_id", link.student_id)
      .single()

    if (existingNewLink) {
      // Link exists — ensure it's active with correct link_type
      const { error: updateErr } = await adminClient
        .from("guardian_student_links")
        .update({
          is_active: true,
          link_type: link.link_type,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingNewLink.id)

      if (updateErr) {
        console.error(
          "[RecoveryApprove] Link update error:",
          updateErr
        )
      } else {
        linksTransferred++
      }
    } else {
      // No existing link — create a new one
      const { error: insertErr } = await adminClient
        .from("guardian_student_links")
        .insert({
          guardian_id: recoveryRequest.new_guardian_id,
          student_id: link.student_id,
          link_type: link.link_type,
          is_active: true,
        })

      if (insertErr) {
        console.error(
          "[RecoveryApprove] Link insert error:",
          insertErr
        )
        return NextResponse.json(
          {
            error: `Could not transfer student link: ${insertErr.message}`,
          },
          { status: 500 }
        )
      }
      linksTransferred++
    }
  }

  // Step 3: Deactivate all links on the old guardian account
  const { error: deactivateError } = await adminClient
    .from("guardian_student_links")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("guardian_id", recoveryRequest.matched_guardian_id)

  if (deactivateError) {
    console.error(
      "[RecoveryApprove] Deactivate links error:",
      deactivateError
    )
    return NextResponse.json(
      { error: "Could not deactivate old account links" },
      { status: 500 }
    )
  }

  // Step 4: Deactivate the old guardian account entirely
  // status = 'DEACTIVATED' exists in the users CHECK constraint
  const { error: oldAccountError } = await adminClient
    .from("users")
    .update({
      status: "DEACTIVATED",
      recovery_transferred_to: recoveryRequest.new_guardian_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recoveryRequest.matched_guardian_id)

  if (oldAccountError) {
    console.error(
      "[RecoveryApprove] Old account deactivation error:",
      oldAccountError
    )
    return NextResponse.json(
      { error: "Could not deactivate old account" },
      { status: 500 }
    )
  }

  // Step 5: Copy guardian profile to new account if it doesn't have one
  // guardian_profiles has national_id columns as NOT NULL so we must
  // copy ALL required fields from the old profile
  const { data: newProfileExists } = await adminClient
    .from("guardian_profiles")
    .select("user_id")
    .eq("user_id", recoveryRequest.new_guardian_id)
    .single()

  if (!newProfileExists) {
    const { data: oldProfile, error: oldProfileError } = await adminClient
      .from("guardian_profiles")
      .select(
        "full_name, phone, fan_fin_encrypted, national_id_front_public_id, national_id_back_public_id, residential_address"
      )
      .eq("user_id", recoveryRequest.matched_guardian_id)
      .single()

    if (oldProfileError) {
      console.error(
        "[RecoveryApprove] Old profile fetch error:",
        oldProfileError
      )
      // Non-fatal — links and deactivation already done
    } else if (oldProfile) {
      const { error: profileInsertError } = await adminClient
        .from("guardian_profiles")
        .insert({
          user_id: recoveryRequest.new_guardian_id,
          full_name: oldProfile.full_name,
          phone: oldProfile.phone,
          fan_fin_encrypted: oldProfile.fan_fin_encrypted,
          national_id_front_public_id:
            oldProfile.national_id_front_public_id,
          national_id_back_public_id:
            oldProfile.national_id_back_public_id,
          residential_address: oldProfile.residential_address,
          is_complete: true,
        })

      if (profileInsertError) {
        console.error(
          "[RecoveryApprove] Profile copy error:",
          profileInsertError
        )
        // Non-fatal — links and deactivation already done
      }
    }
  }

  // Step 6: Mark the recovery request as APPROVED
  const { error: requestUpdateError } = await adminClient
    .from("guardian_recovery_requests")
    .update({
      status: "APPROVED",
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)

  if (requestUpdateError) {
    console.error(
      "[RecoveryApprove] Request status update error:",
      requestUpdateError
    )
    return NextResponse.json(
      { error: "Could not update request status" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: user.id,
    actorRole: "MASTER_ADMIN",
    actionType: "RECOVERY_REQUEST_APPROVED",
    targetTable: "guardian_recovery_requests",
    targetId: requestId,
    oldValue: { status: "PENDING" },
    newValue: {
      status: "APPROVED",
      new_guardian_id: recoveryRequest.new_guardian_id,
      matched_guardian_id: recoveryRequest.matched_guardian_id,
      links_transferred: linksTransferred,
      old_account_deactivated: true,
    },
  })

  // Step 7: SMS to new guardian
  const { data: newGuardianProfile } = await adminClient
    .from("guardian_profiles")
    .select("phone")
    .eq("user_id", recoveryRequest.new_guardian_id)
    .single()

  const smsPhone =
    newGuardianProfile?.phone ?? recoveryRequest.claimed_phone

  if (smsPhone) {
    await queueSms({
      recipientPhone: smsPhone,
      messageBody:
        "Your account recovery request has been approved. You can now access your student enrollments.",
      triggerEvent: "RECOVERY_APPROVED",
      relatedId: requestId,
    })
  }

  return NextResponse.json({
    success: true,
    linksTransferred,
    oldAccountDeactivated: true,
  })
}
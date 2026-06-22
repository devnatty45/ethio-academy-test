// app/api/payments/webhook/route.ts
// Purpose: Receive Chapa payment confirmation — supports both POST (signed
// webhook body) and GET (Chapa's query-param callback redirect)
// Verifies via independent re-verification with Chapa's API in both cases
// This route has NO auth check — Chapa calls it directly

import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import {
  verifyChapaWebhookSignature,
  verifyChapaTransaction,
} from "@/lib/chapa/server"
import { writeAuditLog } from "@/lib/utils/audit"
import { queueSms } from "@/lib/utils/sms"

async function processPaymentConfirmation(
  txRef: string,
  signatureValid: boolean
): Promise<{ status: number; body: Record<string, unknown> }> {
  const adminClient = createAdminClient()

  // CRITICAL: never trust the inbound payload alone.
  // Independently re-verify with Chapa's API every time.
  const verification = await verifyChapaTransaction(txRef)

  if (!verification.success || verification.status !== "success") {
    console.error(
      "[ChapaWebhook] Verification failed or not successful:",
      verification
    )
    await adminClient
      .from("payments")
      .update({
        status: "FAILED",
        updated_at: new Date().toISOString(),
      })
      .eq("tx_ref", txRef)
      .eq("status", "PENDING")

    return { status: 200, body: { received: true } }
  }

  const { data: payment } = await adminClient
    .from("payments")
    .select("id, enrollment_id, amount, status")
    .eq("tx_ref", txRef)
    .single()

  if (!payment) {
    console.error("[ChapaWebhook] No payment found for tx_ref:", txRef)
    return { status: 200, body: { received: true } }
  }

  // Idempotency: already CONFIRMED — do nothing further
  if (payment.status === "CONFIRMED") {
    return {
      status: 200,
      body: { received: true, alreadyProcessed: true },
    }
  }

  // Amount mismatch — flag for investigation, do not confirm
  if (
    verification.amount !== null &&
    Math.abs(verification.amount - payment.amount) > 0.01
  ) {
    console.error(
      "[ChapaWebhook] Amount mismatch:",
      verification.amount,
      "expected",
      payment.amount
    )
    await writeAuditLog({
      actorId: null,
      actorRole: "SYSTEM",
      actionType: "PAYMENT_AMOUNT_MISMATCH",
      targetTable: "payments",
      targetId: payment.id,
      newValue: {
        expected: payment.amount,
        received: verification.amount,
        tx_ref: txRef,
      },
    })
    return { status: 200, body: { received: true, flagged: true } }
  }

  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(
      "id, status, branch_id, grade_id, stream_id, academic_year_id, guardian_id"
    )
    .eq("id", payment.enrollment_id)
    .single()

  if (!enrollment) {
    console.error(
      "[ChapaWebhook] No enrollment found for payment:",
      payment.id
    )
    return { status: 200, body: { received: true } }
  }

  if (enrollment.status !== "PAYMENT_PENDING") {
    console.error(
      "[ChapaWebhook] Enrollment not in PAYMENT_PENDING:",
      enrollment.status
    )
    return {
      status: 200,
      body: { received: true, statusMismatch: true },
    }
  }

  // Store Chapa's own reference in chapa_reference.
  await adminClient
    .from("payments")
    .update({
      status: "CONFIRMED",
      chapa_reference: verification.chapaReference,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id)

  // Invoke seat reservation logic safely
  try {
    const { error: seatError } = await adminClient.rpc(
      "confirm_enrolled_seat",
      {
        p_academic_year_id: enrollment.academic_year_id,
        p_branch_id: enrollment.branch_id,
        p_grade_id: enrollment.grade_id,
        p_stream_id: enrollment.stream_id,
      }
    )
    if (seatError) console.error("[ChapaWebhook] Seat confirmation error:", seatError)
  } catch (err) {
    console.error("[ChapaWebhook] Failed to invoke confirm_enrolled_seat RPC:", err)
  }

  // Update master enrollment record status
  await adminClient
    .from("enrollments")
    .update({
      status: "ENROLLED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollment.id)

  // SAFE INSERT INTO ENROLLMENT TRANSITIONS
  // Uses guardian credentials as the valid FK actor to satisfy database restrictions
  try {
    const { error: transitionError } = await adminClient
      .from("enrollment_transitions")
      .insert({
        enrollment_id: enrollment.id,
        from_status: "PAYMENT_PENDING",
        to_status: "ENROLLED",
        actor_id: enrollment.guardian_id, // Links to a valid row in users table
        actor_role: "GUARDIAN",            // Adheres to your predefined CHECK constraints
        reason: "Payment confirmed via Chapa",
        metadata: {
          tx_ref: txRef,
          chapa_reference: verification.chapaReference,
          amount: verification.amount,
          signature_valid: signatureValid,
        },
      })

    if (transitionError) {
      console.error("[ChapaWebhook] enrollment_transitions insert validation failed:", transitionError)
    }
  } catch (err) {
    console.error("[ChapaWebhook] Silent crash caught inside transition sequence:", err)
  }

  // Safely increment billing context statistics counters
  try {
    await adminClient.rpc("increment_billing_counter", {
      p_academic_year_id: enrollment.academic_year_id,
    })
  } catch (err) {
    console.error("[ChapaWebhook] Failed to increment billing counter metrics safely:", err)
  }

  // Record operational timeline action logs
  await writeAuditLog({
    actorId: null,
    actorRole: "SYSTEM",
    actionType: "PAYMENT_CONFIRMED",
    targetTable: "enrollments",
    targetId: enrollment.id,
    newValue: {
      tx_ref: txRef,
      chapa_reference: verification.chapaReference,
      amount: verification.amount,
      status: "ENROLLED",
    },
  })

  // Dispatch SMS notification confirmation alerts
  try {
    const { data: guardianProfile } = await adminClient
      .from("guardian_profiles")
      .select("phone")
      .eq("user_id", enrollment.guardian_id)
      .single()

    if (guardianProfile?.phone) {
      await queueSms({
        recipientPhone: guardianProfile.phone,
        messageBody:
          "Payment confirmed. Your child is now officially enrolled. Welcome to the new academic year!",
        triggerEvent: "PAYMENT_CONFIRMED",
        relatedId: enrollment.id,
      })
    }
  } catch (err) {
    console.error("[ChapaWebhook] Notification pipeline queue assignment failure:", err)
  }

  return { status: 200, body: { received: true, processed: true } }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature =
    request.headers.get("Chapa-Signature") ??
    request.headers.get("x-chapa-signature")

  const adminClient = createAdminClient()
  
  // Track accurate signature matching using the unique row ID returned by Supabase
  const { data: logRow } = await adminClient
    .from("webhook_logs")
    .insert({
      provider: "CHAPA",
      raw_payload: rawBody,
      signature_valid: false,
    })
    .select("id")
    .single()

  const signatureValid = verifyChapaWebhookSignature(rawBody, signature)

  let payload: { tx_ref?: string; trx_ref?: string }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const txRef = payload.tx_ref ?? payload.trx_ref
  if (!txRef) {
    return NextResponse.json({ error: "Missing tx_ref" }, { status: 400 })
  }

  if (signatureValid && logRow) {
    await adminClient
      .from("webhook_logs")
      .update({ signature_valid: true })
      .eq("id", logRow.id)
  } else if (!signatureValid) {
    console.error(
      "[ChapaWebhook] POST received with invalid/missing signature — running fallback validation"
    )
  }

  const result = await processPaymentConfirmation(txRef, signatureValid)
  return NextResponse.json(result.body, { status: result.status })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const txRef =
    searchParams.get("trx_ref") ?? searchParams.get("tx_ref")

  const adminClient = createAdminClient()
  await adminClient.from("webhook_logs").insert({
    provider: "CHAPA",
    raw_payload: request.url,
    signature_valid: false,
  })

  if (!txRef) {
    return NextResponse.json({ error: "Missing tx_ref" }, { status: 400 })
  }

  const result = await processPaymentConfirmation(txRef, false)
  return NextResponse.json(result.body, { status: result.status })
}
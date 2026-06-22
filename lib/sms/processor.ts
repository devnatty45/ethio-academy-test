// lib/sms/processor.ts
// Purpose: Core SMS queue processing logic — drain PENDING records,
// attempt delivery, record outcomes
// Called by both the Edge Function and the manual trigger route

import { createAdminClient } from "@/lib/supabase/admin"
import { sendSms } from "@/lib/sms/server"

const MAX_RETRIES = 3
const BATCH_SIZE = 50

export interface ProcessResult {
  processed: number
  sent: number
  failed: number
  retrying: number
}

export async function processSmsQueue(): Promise<ProcessResult> {
  const adminClient = createAdminClient()

  const { data: pending, error } = await adminClient
    .from("sms_queue")
    .select(
      "id, recipient_phone, message_body, trigger_event, retry_count"
    )
    .eq("status", "PENDING")
    .lte("retry_count", MAX_RETRIES - 1)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
  console.error("[SmsProcessor] Queue fetch error:", error)
  return { processed: 0, sent: 0, failed: 0, retrying: 0 }
}

  const results: ProcessResult = {
    processed: pending?.length ?? 0,
    sent: 0,
    failed: 0,
    retrying: 0,
  }

  for (const record of pending ?? []) {
    // Add a small delay between sends to avoid rate limiting
    if (results.processed > 1) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    const result = await sendSms(
      record.recipient_phone,
      record.message_body
    )

    if (result.success) {
      await adminClient
        .from("sms_queue")
        .update({
          status: "SENT",
          sent_at: new Date().toISOString(),
          last_attempted_at: new Date().toISOString(),
        })
        .eq("id", record.id)

      results.sent++
    } else {
      const newRetryCount = record.retry_count + 1
      const isFinal = newRetryCount >= MAX_RETRIES

      await adminClient
        .from("sms_queue")
        .update({
          status: isFinal ? "FAILED" : "PENDING",
          retry_count: newRetryCount,
          last_attempted_at: new Date().toISOString(),
        })
        .eq("id", record.id)

      if (isFinal) {
        console.error(
          `[SmsProcessor] Permanently failed after ${MAX_RETRIES} attempts:`,
          {
            id: record.id,
            phone: record.recipient_phone,
            trigger: record.trigger_event,
            error: result.error,
          }
        )
        results.failed++
      } else {
        results.retrying++
      }
    }
  }

  return results
}
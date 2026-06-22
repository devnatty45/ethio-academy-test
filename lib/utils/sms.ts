// lib/utils/sms.ts
// SMS queue helper — adds messages to the sms_queue table
// Never sends SMS directly — always goes through the queue
// SMS is fire-and-forget: failures never block the calling operation

import { createAdminClient } from "@/lib/supabase/admin"

interface SmsQueueEntry {
  recipientPhone: string
  messageBody: string
  triggerEvent: string
  relatedId?: string
}

/**
 * Queue an SMS for sending via the background pg_cron job.
 * Returns immediately — never awaits delivery.
 * Never throws — SMS failure must never block the caller.
 */
export async function queueSms(entry: SmsQueueEntry): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from("sms_queue").insert({
      recipient_phone: entry.recipientPhone,
      message_body: entry.messageBody,
      trigger_event: entry.triggerEvent,
      related_id: entry.relatedId ?? null,
      status: "PENDING",
      retry_count: 0,
    })
  } catch (err) {
    // Never throw — SMS queue failure must not block the caller
    console.error("[SMS] Failed to queue SMS:", err)
  }
}
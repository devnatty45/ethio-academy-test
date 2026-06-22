// supabase/functions/process-sms-queue/index.ts
// Supabase Edge Function — called by pg_cron every 2 minutes
// Deploy with: supabase functions deploy process-sms-queue

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const MAX_RETRIES = 3
const BATCH_SIZE = 50
const SMS_ETHIOPIA_BASE_URL = "https://smsethiopia.com/api"

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\s+/g, "").replace(/-/g, "")
  if (cleaned.startsWith("+251")) return cleaned
  if (cleaned.startsWith("251") && cleaned.length === 12)
    return `+${cleaned}`
  if (cleaned.startsWith("0") && cleaned.length === 10)
    return `+251${cleaned.slice(1)}`
  if (cleaned.length === 9) return `+251${cleaned}`
  return cleaned
}

async function sendSms(
  phone: string,
  message: string,
  apiKey: string,
  senderId: string
): Promise<{ success: boolean; error: string | null }> {
  // SMS Ethiopia expects clean digits without the '+' sign (e.g., 2519...)
  const normalizedPhone = normalizePhone(phone).replace("+", "")

  try {
    const response = await fetch(`${SMS_ETHIOPIA_BASE_URL}/sms/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "KEY": apiKey, // Use custom validation header instead of Bearer token
      },
      body: JSON.stringify({
        sender: senderId,
        msisdn: normalizedPhone, // Corrected parameter payload key
        text: message,           // Corrected parameter payload key
      }),
    })

    console.log(`📡 [SMS API HTTP Status]: ${response.status} ${response.statusText}`)
    
    const textData = await response.text()
    console.log("📄 [SMS API Raw Response Text]:", textData)

    let data: any = {}
    try {
      data = JSON.parse(textData)
    } catch {
      return {
        success: false,
        error: `Failed to parse JSON response. Status: ${response.status}`,
      }
    }

    // Validate using the explicit response flag sent by the gateway
    if (!response.ok || data.sent !== true) {
      return {
        success: false,
        error: data.description ?? `HTTP ${response.status}`,
      }
    }

    return { success: true, error: null }
  } catch (err) {
    console.error("🚨 [SMS Network Catch Error]:", err)
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    }
  }
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const apiKey = Deno.env.get("SMS_ETHIOPIA_API_KEY")!
  const senderId =
    Deno.env.get("SMS_ETHIOPIA_SENDER_ID") ?? "EthioAcademy"

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "SMS_ETHIOPIA_API_KEY not set" }),
      { status: 500 }
    )
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey)

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
    return new Response(
      JSON.stringify({ error: "Queue fetch failed" }),
      { status: 500 }
    )
  }

  let sent = 0
  let failed = 0
  let retrying = 0

  for (const record of pending ?? []) {
    await new Promise((resolve) => setTimeout(resolve, 200))

    const result = await sendSms(
      record.recipient_phone,
      record.message_body,
      apiKey,
      senderId
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
      sent++
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
      if (isFinal) failed++
      else retrying++
    }
  }

  return new Response(
    JSON.stringify({
      processed: pending?.length ?? 0,
      sent,
      failed,
      retrying,
    }),
    { headers: { "Content-Type": "application/json" } }
  )
})
// components/admin/stream-change-form.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface Stream {
  id: string
  name: string
}

interface StreamChangeFormProps {
  enrollmentId: string
  currentStreamId: string
  availableStreams: Stream[]
  onSuccess: () => void
}

export default function StreamChangeForm({
  enrollmentId,
  currentStreamId,
  availableStreams,
  onSuccess,
}: StreamChangeFormProps) {
  const [newStreamId, setNewStreamId] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const otherStreams = availableStreams.filter(
    (s) => s.id !== currentStreamId
  )

  async function handleSubmit() {
    setError(null)
    if (!newStreamId) {
      setError("Select a target stream")
      return
    }
    if (reason.trim().length < 10) {
      setError("Reason must be at least 10 characters")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(
        `/api/admin/branch/enrollments/${enrollmentId}/change-stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newStreamId,
            reason: reason.trim(),
          }),
        }
      )
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not change stream")
        return
      }
      onSuccess()
    } catch {
      setError("Could not change stream. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <p className="text-sm font-medium text-foreground">
        Change Stream
      </p>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <select
        value={newStreamId}
        onChange={(e) => setNewStreamId(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
      >
        <option value="">Select new stream...</option>
        {otherStreams.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for stream change..."
        rows={2}
        maxLength={500}
      />

      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={submitting || !newStreamId}
      >
        {submitting ? "Changing..." : "Confirm Stream Change"}
      </Button>
    </div>
  )
}
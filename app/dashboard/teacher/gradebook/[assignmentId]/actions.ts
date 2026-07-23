// app/dashboard/teacher/gradebook/[assignmentId]/actions.ts
// Purpose: Server action for teachers to save marks — relies entirely on
// the DB trigger (validate_student_subject_mark) for authorization and
// finalization-lock checks, so there's no duplicate logic to keep in sync.
"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export async function saveMark(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated." }
  }

  const enrollmentId = formData.get("enrollment_id") as string
  const subjectId = formData.get("subject_id") as string
  const termId = formData.get("term_id") as string
  const gradingType = formData.get("grading_type") as string
  const assignmentId = formData.get("assignment_id") as string

  // IMPORTANT: use the user's own session client (not adminClient) so
  // the RLS policy + trigger's auth.uid() check applies exactly as if
  // the teacher ran this SQL themselves — this is what makes the DB
  // the real gatekeeper, not this action.
  let payload: Record<string, any> = {
    enrollment_id: enrollmentId,
    subject_id: subjectId,
    term_id: termId,
  }

  if (gradingType === "LETTER") {
    const letter = formData.get("letter_grade") as string
    if (!letter) return { error: "Letter grade is required." }
    payload.letter_grade = letter
  } else {
    const fields = ["quiz_1", "quiz_2", "quiz_3", "test_1", "test_2", "test_3", "final_exam"]
    for (const f of fields) {
      const raw = formData.get(f) as string
      payload[f] = raw === "" || raw === null ? null : parseFloat(raw)
    }
  }

  const { error } = await supabase
    .from("student_subject_marks")
    .upsert(payload, { onConflict: "enrollment_id,subject_id,term_id" })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/dashboard/teacher/gradebook/${assignmentId}`)
  return { success: true }
}

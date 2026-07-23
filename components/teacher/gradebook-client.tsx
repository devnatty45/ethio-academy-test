// components/teacher/gradebook-client.tsx
// Purpose: Client component — term toggle + inline mark-entry grid,
// auto-saves each field on blur
"use client"

import { useState, useEffect, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { saveMark } from "@/app/dashboard/teacher/gradebook/[assignmentId]/actions"
 
type Term = { id: string; name: string; term_order: number; status: string }
type Student = { enrollment_id: string; full_name: string; stu_id: string }
type MarkRow = {
  quiz_1: number | null
  quiz_2: number | null
  quiz_3: number | null
  test_1: number | null
  test_2: number | null
  test_3: number | null
  final_exam: number | null
  total_score: number | null
  letter_grade: string | null
}

const LETTER_OPTIONS = ["A+", "A", "B+", "B", "C+", "C", "D", "F"]

export default function GradebookClient({
  assignmentId,
  subjectId,
  gradingType,
  terms,
  students,
  finalizedTermIds,
}: {
  assignmentId: string
  subjectId: string
  gradingType: string
  terms: Term[]
  students: Student[]
  finalizedTermIds: string[]
}) {
  const supabase = createClient()
  const [termId, setTermId] = useState(terms[0]?.id ?? "")
  const [marks, setMarks] = useState<Record<string, MarkRow>>({})
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isLocked = finalizedTermIds.includes(termId)

  async function loadMarks() {
    if (!termId || students.length === 0) return
    setLoading(true)
    const enrollmentIds = students.map((s) => s.enrollment_id)

    const { data } = await supabase
      .from("student_subject_marks")
      .select("enrollment_id, quiz_1, quiz_2, quiz_3, test_1, test_2, test_3, final_exam, total_score, letter_grade")
      .eq("subject_id", subjectId)
      .eq("term_id", termId)
      .in("enrollment_id", enrollmentIds)

    const map: Record<string, MarkRow> = {}
    data?.forEach((m) => {
      map[m.enrollment_id] = m
    })
    setMarks(map)
    setLoading(false)
  }

  useEffect(() => {
    loadMarks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termId])

  function handleFieldChange(enrollmentId: string, field: string, value: string) {
    setMarks((prev) => ({
      ...prev,
      [enrollmentId]: {
        ...(prev[enrollmentId] ?? {
          quiz_1: null, quiz_2: null, quiz_3: null,
          test_1: null, test_2: null, test_3: null,
          final_exam: null, total_score: null, letter_grade: null,
        }),
        [field]: value,
      },
    }))
  }

  function handleSave(enrollmentId: string) {
    const row = marks[enrollmentId]
    if (!row) return

    setSavingKey(enrollmentId)
    setMessage(null)

    const formData = new FormData()
    formData.set("enrollment_id", enrollmentId)
    formData.set("subject_id", subjectId)
    formData.set("term_id", termId)
    formData.set("grading_type", gradingType)
    formData.set("assignment_id", assignmentId)

    if (gradingType === "LETTER") {
      formData.set("letter_grade", row.letter_grade ?? "")
    } else {
      ;["quiz_1", "quiz_2", "quiz_3", "test_1", "test_2", "test_3", "final_exam"].forEach((f) => {
        const v = (row as any)[f]
        formData.set(f, v === null || v === undefined ? "" : String(v))
      })
    }

    startTransition(async () => {
      const res = await saveMark(formData)
      setSavingKey(null)
      if (res.error) {
        setMessage(`Error saving ${enrollmentId.slice(0, 8)}: ${res.error}`)
      } else {
        await loadMarks()
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Term toggle */}
      <div className="flex items-center gap-2">
        {terms.map((t) => (
          <button
            key={t.id}
            onClick={() => setTermId(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              termId === t.id
                ? "bg-[#6c63ff] text-white"
                : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
            }`}
          >
            {t.name.replace("_", " ")}
            {finalizedTermIds.includes(t.id) && " 🔒"}
          </button>
        ))}
      </div>

      {isLocked && (
        <div className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 rounded-lg px-4 py-3">
          This term has been finalized by a branch admin. Marks are locked and cannot be edited.
        </div>
      )}

      {message && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/10 border border-red-200/50 rounded-lg px-4 py-3">
          {message}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          No students allocated to this section yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10 text-left">
                <th className="py-2 pr-3 font-medium text-gray-500">Student</th>
                {gradingType === "LETTER" ? (
                  <th className="py-2 px-2 font-medium text-gray-500">Grade</th>
                ) : (
                  <>
                    <th className="py-2 px-2 font-medium text-gray-500">Q1</th>
                    <th className="py-2 px-2 font-medium text-gray-500">Q2</th>
                    <th className="py-2 px-2 font-medium text-gray-500">Q3</th>
                    <th className="py-2 px-2 font-medium text-gray-500">T1</th>
                    <th className="py-2 px-2 font-medium text-gray-500">T2</th>
                    <th className="py-2 px-2 font-medium text-gray-500">T3</th>
                    <th className="py-2 px-2 font-medium text-gray-500">Final</th>
                    <th className="py-2 px-2 font-medium text-gray-500">Total</th>
                  </>
                )}
                <th className="py-2 pl-2"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const row = marks[s.enrollment_id] ?? {
                  quiz_1: null, quiz_2: null, quiz_3: null,
                  test_1: null, test_2: null, test_3: null,
                  final_exam: null, total_score: null, letter_grade: null,
                }
                const isSaving = savingKey === s.enrollment_id

                return (
                  <tr key={s.enrollment_id} className="border-b border-gray-50 dark:border-white/5">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-gray-900 dark:text-white">{s.full_name}</p>
                      <p className="text-xs text-gray-400">{s.stu_id}</p>
                    </td>

                    {gradingType === "LETTER" ? (
                      <td className="py-2 px-2">
                        <select
                          disabled={isLocked}
                          value={row.letter_grade ?? ""}
                          onChange={(e) => handleFieldChange(s.enrollment_id, "letter_grade", e.target.value)}
                          onBlur={() => handleSave(s.enrollment_id)}
                          className="w-20 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1 text-sm disabled:opacity-50"
                        >
                          <option value="">—</option>
                          {LETTER_OPTIONS.map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </td>
                    ) : (
                      <>
                        {[
                          { field: "quiz_1", max: 5 },
                          { field: "quiz_2", max: 5 },
                          { field: "quiz_3", max: 5 },
                          { field: "test_1", max: 15 },
                          { field: "test_2", max: 15 },
                          { field: "test_3", max: 15 },
                          { field: "final_exam", max: 40 },
                        ].map(({ field, max }) => (
                          <td key={field} className="py-2 px-2">
                            <input
                              type="number"
                              min={0}
                              max={max}
                              step={0.5}
                              disabled={isLocked}
                              value={(row as any)[field] ?? ""}
                              onChange={(e) => handleFieldChange(s.enrollment_id, field, e.target.value)}
                              onBlur={() => handleSave(s.enrollment_id)}
                              className="w-14 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-1.5 py-1 text-sm disabled:opacity-50"
                            />
                          </td>
                        ))}
                        <td className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">
                          {row.total_score ?? "—"}
                        </td>
                      </>
                    )}

                    <td className="py-2 pl-2">
                      {isSaving && <span className="text-xs text-gray-400">Saving...</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

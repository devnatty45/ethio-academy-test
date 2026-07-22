// components/admin/subject-manager-client.tsx
// Purpose: Client component — add subjects, list them grouped by grade, toggle/delete
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createSubject, toggleSubjectActive, deleteSubject } from "@/app/dashboard/master/subjects/actions"

type Grade = { id: string; name: string; level_order: number }
type Stream = { id: string; name: string }
type Subject = {
  id: string
  grade_id: string
  stream_id: string | null
  name: string
  grading_type: string
  pass_mark_percent: number
  is_active: boolean
  grades: { name: string; level_order: number } | { name: string; level_order: number }[] | null
  streams: { name: string } | { name: string }[] | null
}

function single<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v
}

// Grade 11 = level_order 14, Grade 12 = level_order 15 (per existing grades seed data)
const STREAM_ELIGIBLE_LEVEL_ORDER = 14

export default function SubjectManagerClient({
  grades,
  streams,
  initialSubjects,
}: {
  grades: Grade[]
  streams: Stream[]
  initialSubjects: Subject[]
}) {
  const router = useRouter()
  const [selectedGradeId, setSelectedGradeId] = useState(grades[0]?.id ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedGrade = grades.find((g) => g.id === selectedGradeId)
  const showStreamOption = (selectedGrade?.level_order ?? 0) >= STREAM_ELIGIBLE_LEVEL_ORDER

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await createSubject(formData)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  function handleToggle(id: string, current: boolean) {
    startTransition(async () => {
      await toggleSubjectActive(id, !current)
      router.refresh()
    })
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this subject? This cannot be undone.")) return
    startTransition(async () => {
      const res = await deleteSubject(id)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  // Group subjects by grade for display
  const grouped = grades.map((g) => ({
    grade: g,
    subjects: initialSubjects.filter((s) => s.grade_id === g.id),
  }))

  return (
    <div className="space-y-8">
      {/* Add subject form */}
      <form action={handleSubmit} className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add Subject</h2>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/10 border border-red-200/50 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Grade
            </label>
            <select
              name="grade_id"
              value={selectedGradeId}
              onChange={(e) => setSelectedGradeId(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {showStreamOption && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Stream (leave blank for Common)
              </label>
              <select
                name="stream_id"
                defaultValue=""
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white"
              >
                <option value="">Common (all streams)</option>
                {streams.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Subject Name
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. Mathematics"
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Grading Type
            </label>
            <select
              name="grading_type"
              defaultValue="NUMERIC"
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              <option value="NUMERIC">Numeric (quiz/test/final out of 100)</option>
              <option value="LETTER">Letter grade (e.g. Computer)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Pass Mark %
            </label>
            <input
              type="number"
              name="pass_mark_percent"
              defaultValue={50}
              min={1}
              max={100}
              step={0.5}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <Button type="submit" disabled={isPending}>
          Add Subject
        </Button>
      </form>

      <div className="border-t border-gray-100 dark:border-white/10" />

      {/* Subject list grouped by grade */}
      <div className="space-y-6">
        {grouped.map(({ grade, subjects: gradeSubjects }) => (
          <div key={grade.id}>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {grade.name}{" "}
              <span className="text-xs font-normal text-gray-400">
                ({gradeSubjects.length} subject{gradeSubjects.length !== 1 ? "s" : ""})
              </span>
            </h3>
            {gradeSubjects.length === 0 ? (
              <p className="text-xs text-gray-400 pl-1">No subjects added yet.</p>
            ) : (
              <div className="space-y-2">
                {gradeSubjects.map((s) => {
                  const streamName = single(s.streams)?.name
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 border border-gray-100 dark:border-white/10 rounded-lg px-4 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {s.name}
                          {streamName && (
                            <span className="ml-2 text-xs font-normal text-[#6c63ff] bg-[#6c63ff]/10 px-2 py-0.5 rounded-full">
                              {streamName}
                            </span>
                          )}
                          {!streamName && s.stream_id === null && grade.level_order >= STREAM_ELIGIBLE_LEVEL_ORDER && (
                            <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full">
                              Common
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {s.grading_type === "LETTER" ? "Letter grade" : `Numeric · pass mark ${s.pass_mark_percent}%`}
                          {!s.is_active && " · Inactive"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => handleToggle(s.id, s.is_active)}
                        >
                          {s.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50"
                          disabled={isPending}
                          onClick={() => handleDelete(s.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

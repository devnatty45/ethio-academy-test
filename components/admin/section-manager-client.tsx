// components/admin/section-manager-client.tsx
// Purpose: Client component — create sections, list grouped by academic year + grade
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createSection, toggleSectionActive, deleteSection } from "@/app/dashboard/branch/sections/actions"

type Grade = { id: string; name: string; level_order: number }
type Stream = { id: string; name: string }
type AcademicYear = { id: string; name: string; status: string }
type Section = {
  id: string
  grade_id: string
  stream_id: string | null
  academic_year_id: string
  name: string
  max_capacity: number
  is_active: boolean
  grades: { name: string; level_order: number } | { name: string; level_order: number }[] | null
  streams: { name: string } | { name: string }[] | null
  academic_years: { name: string } | { name: string }[] | null
}

function single<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v
}

const STREAM_ELIGIBLE_LEVEL_ORDER = 14

export default function SectionManagerClient({
  grades,
  streams,
  academicYears,
  initialSections,
}: {
  grades: Grade[]
  streams: Stream[]
  academicYears: AcademicYear[]
  initialSections: Section[]
}) {
  const router = useRouter()
  const defaultYear = academicYears.find((y) => y.status === "OPEN") ?? academicYears[0]
  const [selectedYearId, setSelectedYearId] = useState(defaultYear?.id ?? "")
  const [selectedGradeId, setSelectedGradeId] = useState(grades[0]?.id ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [filterYearId, setFilterYearId] = useState(defaultYear?.id ?? "")

  const selectedGrade = grades.find((g) => g.id === selectedGradeId)
  const showStreamOption = (selectedGrade?.level_order ?? 0) >= STREAM_ELIGIBLE_LEVEL_ORDER

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await createSection(formData)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  function handleToggle(id: string, current: boolean) {
    startTransition(async () => {
      await toggleSectionActive(id, !current)
      router.refresh()
    })
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this section? This cannot be undone.")) return
    startTransition(async () => {
      const res = await deleteSection(id)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  const yearFiltered = initialSections.filter((s) => s.academic_year_id === filterYearId)
  const grouped = grades.map((g) => ({
    grade: g,
    sections: yearFiltered.filter((s) => s.grade_id === g.id),
  }))

  return (
    <div className="space-y-8">
      {/* Add section form */}
      <form action={handleSubmit} className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add Section</h2>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/10 border border-red-200/50 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Academic Year
            </label>
            <select
              name="academic_year_id"
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.status !== "OPEN" ? `(${y.status})` : ""}
                </option>
              ))}
            </select>
          </div>

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
                Stream
              </label>
              <select
                name="stream_id"
                required
                defaultValue=""
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white"
              >
                <option value="" disabled>
                  Select stream
                </option>
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
              Section Name
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. Section A"
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Max Capacity
            </label>
            <input
              type="number"
              name="max_capacity"
              required
              min={1}
              placeholder="e.g. 40"
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <Button type="submit" disabled={isPending}>
          Add Section
        </Button>
      </form>

      <div className="border-t border-gray-100 dark:border-white/10" />

      {/* Filter + list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Existing Sections</h2>
          <select
            value={filterYearId}
            onChange={(e) => setFilterYearId(e.target.value)}
            className="text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5"
          >
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-6">
          {grouped.map(({ grade, sections: gradeSections }) => (
            <div key={grade.id}>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {grade.name}{" "}
                <span className="text-xs font-normal text-gray-400">
                  ({gradeSections.length} section{gradeSections.length !== 1 ? "s" : ""})
                </span>
              </h3>
              {gradeSections.length === 0 ? (
                <p className="text-xs text-gray-400 pl-1">No sections yet for this year.</p>
              ) : (
                <div className="space-y-2">
                  {gradeSections.map((s) => {
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
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Capacity: {s.max_capacity}
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
    </div>
  )
}

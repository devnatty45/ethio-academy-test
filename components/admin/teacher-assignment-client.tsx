// components/admin/teacher-assignment-client.tsx
// Purpose: Client component — pick year/grade/stream/section, assign a
// teacher to each subject that belongs to that grade/stream
"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { assignTeacherToSubject, removeAssignment } from "@/app/dashboard/branch/teacher-assignments/actions"

type Grade = { id: string; name: string; level_order: number }
type Stream = { id: string; name: string }
type AcademicYear = { id: string; name: string; status: string }
type Teacher = { id: string; full_name: string }
type SectionOption = { id: string; name: string }
type SubjectRow = {
  subject_id: string
  subject_name: string
  grading_type: string
  assignment_id: string | null
  teacher_id: string | null
  teacher_name: string | null
}

const STREAM_ELIGIBLE_LEVEL_ORDER = 14

export default function TeacherAssignmentClient({
  branchId,
  academicYears,
  grades,
  streams,
  teachers,
}: {
  branchId: string
  academicYears: AcademicYear[]
  grades: Grade[]
  streams: Stream[]
  teachers: Teacher[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const defaultYear = academicYears.find((y) => y.status === "OPEN") ?? academicYears[0]
  const [yearId, setYearId] = useState(defaultYear?.id ?? "")
  const [gradeId, setGradeId] = useState(grades[0]?.id ?? "")
  const [streamId, setStreamId] = useState<string>("")
  const [sections, setSections] = useState<SectionOption[]>([])
  const [sectionId, setSectionId] = useState<string>("")
  const [subjectRows, setSubjectRows] = useState<SubjectRow[]>([])
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const selectedGrade = grades.find((g) => g.id === gradeId)
  const needsStream = (selectedGrade?.level_order ?? 0) >= STREAM_ELIGIBLE_LEVEL_ORDER
  const effectiveStreamId = needsStream ? streamId || null : null

  // Load sections whenever year/grade/stream changes
  useEffect(() => {
    async function loadSections() {
      setSectionId("")
      setSubjectRows([])
      if (!gradeId || !yearId || (needsStream && !streamId)) {
        setSections([])
        return
      }
      let q = supabase
        .from("sections")
        .select("id, name")
        .eq("branch_id", branchId)
        .eq("grade_id", gradeId)
        .eq("academic_year_id", yearId)
        .eq("is_active", true)
        .order("name")

      q = effectiveStreamId ? q.eq("stream_id", effectiveStreamId) : q.is("stream_id", null)

      const { data } = await q
      setSections(data ?? [])
    }
    loadSections()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeId, streamId, yearId])

  // Load subjects + existing assignments whenever section changes
  async function loadSubjectRows() {
    if (!sectionId) {
      setSubjectRows([])
      return
    }
    setLoading(true)

    let subjQuery = supabase
      .from("subjects")
      .select("id, name, grading_type")
      .eq("grade_id", gradeId)
      .eq("is_active", true)
      .order("name")

    // Subject is Common (NULL) OR matches this section's stream
    subjQuery = effectiveStreamId
      ? subjQuery.or(`stream_id.is.null,stream_id.eq.${effectiveStreamId}`)
      : subjQuery.is("stream_id", null)

    const { data: subjects } = await subjQuery

    const { data: assignments } = await supabase
      .from("teacher_subject_assignments")
      .select("id, subject_id, teacher_id, teacher_profiles(full_name)")
      .eq("section_id", sectionId)
      .eq("is_active", true)

    const assignMap = new Map(
      (assignments ?? []).map((a: any) => [
        a.subject_id,
        {
          assignment_id: a.id,
          teacher_id: a.teacher_id,
          teacher_name: (Array.isArray(a.teacher_profiles) ? a.teacher_profiles[0] : a.teacher_profiles)?.full_name ?? null,
        },
      ])
    )

    setSubjectRows(
      (subjects ?? []).map((s) => {
        const a = assignMap.get(s.id)
        return {
          subject_id: s.id,
          subject_name: s.name,
          grading_type: s.grading_type,
          assignment_id: a?.assignment_id ?? null,
          teacher_id: a?.teacher_id ?? null,
          teacher_name: a?.teacher_name ?? null,
        }
      })
    )
    setLoading(false)
  }

  useEffect(() => {
    loadSubjectRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId])

  function handleAssign(subjectId: string, teacherId: string) {
    if (!teacherId) return
    startTransition(async () => {
      await assignTeacherToSubject(sectionId, subjectId, teacherId, yearId)
      await loadSubjectRows()
      router.refresh()
    })
  }

  function handleRemove(assignmentId: string) {
    startTransition(async () => {
      await removeAssignment(assignmentId)
      await loadSubjectRows()
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Academic Year
          </label>
          <select
            value={yearId}
            onChange={(e) => setYearId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
          >
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Grade
          </label>
          <select
            value={gradeId}
            onChange={(e) => {
              setGradeId(e.target.value)
              setStreamId("")
            }}
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
          >
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        {needsStream && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Stream
            </label>
            <select
              value={streamId}
              onChange={(e) => setStreamId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
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
            Section
          </label>
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            disabled={sections.length === 0}
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              {sections.length === 0 ? "No sections" : "Select section"}
            </option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Subject rows */}
      {!sectionId ? (
        <p className="text-sm text-gray-400 text-center py-8">
          Select a section to see its subjects.
        </p>
      ) : loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
      ) : subjectRows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          No subjects found for this grade/stream. Add subjects first under Manage Subjects.
        </p>
      ) : (
        <div className="space-y-2">
          {subjectRows.map((row) => (
            <div
              key={row.subject_id}
              className="flex items-center justify-between gap-3 border border-gray-100 dark:border-white/10 rounded-lg px-4 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {row.subject_name}
                  {row.grading_type === "LETTER" && (
                    <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full">
                      Letter grade
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {row.teacher_id ? (
                  <>
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                      {row.teacher_name}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      disabled={isPending}
                      onClick={() => row.assignment_id && handleRemove(row.assignment_id)}
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <select
                    defaultValue=""
                    disabled={isPending}
                    onChange={(e) => handleAssign(row.subject_id, e.target.value)}
                    className="text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1.5"
                  >
                    <option value="" disabled>
                      Assign teacher
                    </option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

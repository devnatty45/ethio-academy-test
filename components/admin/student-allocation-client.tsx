// components/admin/student-allocation-client.tsx
// Purpose: Client component — pick grade/stream/year, view sections + unallocated
// students, manually assign or auto-split
"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import {
  allocateStudent,
  unallocateStudent,
  autoSplitSections,
} from "@/app/dashboard/branch/allocations/actions"

type Grade = { id: string; name: string; level_order: number }
type Stream = { id: string; name: string }
type AcademicYear = { id: string; name: string; status: string }

type SectionRow = { id: string; name: string; max_capacity: number; occupied: number }
type StudentRow = { enrollment_id: string; student_name: string; stu_id: string; section_id: string | null; section_name: string | null }

const STREAM_ELIGIBLE_LEVEL_ORDER = 14

export default function StudentAllocationClient({
  branchId,
  academicYears,
  grades,
  streams,
}: {
  branchId: string
  academicYears: AcademicYear[]
  grades: Grade[]
  streams: Stream[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const defaultYear = academicYears.find((y) => y.status === "OPEN") ?? academicYears[0]
  const [yearId, setYearId] = useState(defaultYear?.id ?? "")
  const [gradeId, setGradeId] = useState(grades[0]?.id ?? "")
  const [streamId, setStreamId] = useState<string>("")
  const [sections, setSections] = useState<SectionRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedGrade = grades.find((g) => g.id === gradeId)
  const needsStream = (selectedGrade?.level_order ?? 0) >= STREAM_ELIGIBLE_LEVEL_ORDER
  const effectiveStreamId = needsStream ? streamId || null : null

  async function loadData() {
    if (!gradeId || !yearId || (needsStream && !streamId)) {
      setSections([])
      setStudents([])
      return
    }
    setLoading(true)
    setMessage(null)

    let sectionQuery = supabase
      .from("sections")
      .select("id, name, max_capacity")
      .eq("branch_id", branchId)
      .eq("grade_id", gradeId)
      .eq("academic_year_id", yearId)
      .eq("is_active", true)
      .order("name")

    sectionQuery = effectiveStreamId
      ? sectionQuery.eq("stream_id", effectiveStreamId)
      : sectionQuery.is("stream_id", null)

    const { data: sectionData } = await sectionQuery

    const sectionIds = (sectionData ?? []).map((s) => s.id)
    const { data: allocData } = await supabase
      .from("student_section_allocations")
      .select("section_id")
      .in("section_id", sectionIds.length > 0 ? sectionIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("is_active", true)

    const occupancy: Record<string, number> = {}
    ;(sectionData ?? []).forEach((s) => (occupancy[s.id] = 0))
    allocData?.forEach((a) => (occupancy[a.section_id] = (occupancy[a.section_id] ?? 0) + 1))

    setSections((sectionData ?? []).map((s) => ({ ...s, occupied: occupancy[s.id] ?? 0 })))

    let enrollQuery = supabase
      .from("enrollments")
      .select("id, students(full_name, stu_id)")
      .eq("branch_id", branchId)
      .eq("grade_id", gradeId)
      .eq("academic_year_id", yearId)
      .eq("status", "ENROLLED")

    enrollQuery = effectiveStreamId
      ? enrollQuery.eq("stream_id", effectiveStreamId)
      : enrollQuery.is("stream_id", null)

    const { data: enrollData } = await enrollQuery

    const enrollmentIds = (enrollData ?? []).map((e) => e.id)
    const { data: existingAllocations } = await supabase
      .from("student_section_allocations")
      .select("enrollment_id, section_id, sections(name)")
      .in("enrollment_id", enrollmentIds.length > 0 ? enrollmentIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("is_active", true)

    const allocMap = new Map(
      (existingAllocations ?? []).map((a) => [
        a.enrollment_id,
        { section_id: a.section_id, section_name: (Array.isArray(a.sections) ? a.sections[0] : a.sections)?.name ?? null },
      ])
    )

    setStudents(
      (enrollData ?? []).map((e: any) => {
        const student = Array.isArray(e.students) ? e.students[0] : e.students
        const alloc = allocMap.get(e.id)
        return {
          enrollment_id: e.id,
          student_name: student?.full_name ?? "Unknown",
          stu_id: student?.stu_id ?? "—",
          section_id: alloc?.section_id ?? null,
          section_name: alloc?.section_name ?? null,
        }
      })
    )
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeId, streamId, yearId])

  function handleAssign(enrollmentId: string, sectionId: string) {
    if (!sectionId) return
    startTransition(async () => {
      await allocateStudent(enrollmentId, sectionId)
      await loadData()
      router.refresh()
    })
  }

  function handleUnassign(enrollmentId: string) {
    startTransition(async () => {
      await unallocateStudent(enrollmentId)
      await loadData()
      router.refresh()
    })
  }

  function handleAutoSplit() {
    startTransition(async () => {
      const res = await autoSplitSections(gradeId, effectiveStreamId, yearId)
      setMessage(res.error ?? res.message ?? null)
      await loadData()
      router.refresh()
    })
  }

  const unallocatedCount = students.filter((s) => !s.section_id).length

  return (
    <div className="space-y-6">
      {/* Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
      </div>

      {message && (
        <div className="text-sm text-gray-700 dark:text-gray-300 bg-[#6c63ff]/5 border border-[#6c63ff]/15 rounded-lg px-4 py-3">
          {message}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
      ) : (
        <>
          {/* Section capacity overview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Sections ({unallocatedCount} unallocated student{unallocatedCount !== 1 ? "s" : ""})
              </h2>
              <Button
                size="sm"
                disabled={isPending || sections.length === 0 || unallocatedCount === 0}
                onClick={handleAutoSplit}
              >
                Auto-Split Evenly
              </Button>
            </div>
            {sections.length === 0 ? (
              <p className="text-xs text-gray-400">No sections exist yet for this grade/stream/year.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sections.map((s) => (
                  <div key={s.id} className="border border-gray-100 dark:border-white/10 rounded-lg px-3 py-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</p>
                    <p className="text-xs text-gray-400">
                      {s.occupied}/{s.max_capacity}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Student list */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Enrolled Students ({students.length})
            </h2>
            {students.length === 0 ? (
              <p className="text-xs text-gray-400">No enrolled students found for this selection.</p>
            ) : (
              <div className="space-y-2">
                {students.map((s) => (
                  <div
                    key={s.enrollment_id}
                    className="flex items-center justify-between gap-3 border border-gray-100 dark:border-white/10 rounded-lg px-4 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{s.student_name}</p>
                      <p className="text-xs text-gray-400">{s.stu_id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.section_id ? (
                        <>
                          <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                            {s.section_name}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50"
                            disabled={isPending}
                            onClick={() => handleUnassign(s.enrollment_id)}
                          >
                            Remove
                          </Button>
                        </>
                      ) : (
                        <select
                          defaultValue=""
                          disabled={isPending}
                          onChange={(e) => handleAssign(s.enrollment_id, e.target.value)}
                          className="text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1.5"
                        >
                          <option value="" disabled>
                            Assign section
                          </option>
                          {sections.map((sec) => (
                            <option key={sec.id} value={sec.id} disabled={sec.occupied >= sec.max_capacity}>
                              {sec.name} ({sec.occupied}/{sec.max_capacity})
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
        </>
      )}
    </div>
  )
}

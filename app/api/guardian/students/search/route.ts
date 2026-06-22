// app/api/guardian/students/search/route.ts
// Purpose: Run fuzzy match against existing students before creation
// Who can call it: authenticated GUARDIAN only with complete profile

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { normalizeName, normalizeDob } from "@/lib/utils/normalize"
import { isGuardianProfileComplete } from "@/lib/utils/guardian"
import { dobSchema, genderSchema } from "@/lib/validations/common"

const searchSchema = z.object({
  fullName: z.string().min(2).max(100).trim(),
  dateOfBirth: dobSchema,
  gender: genderSchema,
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!userData || userData.role !== "GUARDIAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Require complete profile
  const profileComplete = await isGuardianProfileComplete(user.id)
  if (!profileComplete) {
    return NextResponse.json(
      { error: "Complete your profile before adding students" },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const result = searchSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { fullName, dateOfBirth, gender } = result.data

  const nameNormalized = normalizeName(fullName)
  const dobNormalized = normalizeDob(dateOfBirth)

  // Run fuzzy search
  const { data: matches, error: searchError } = await adminClient.rpc(
    "search_students_fuzzy",
    {
      p_name_normalized: nameNormalized,
      p_dob_normalized: dobNormalized,
      p_similarity_threshold: 0.4,
    }
  )

  if (searchError) {
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    )
  }

  // Classify matches by confidence
  const classified = (matches ?? []).map(
    (m: {
      id: string
      stu_id: string
      full_name: string
      date_of_birth: string
      gender: string
      status: string
      name_similarity: number
      dob_matches: boolean
      overall_score: number
    }) => ({
      ...m,
      confidence:
        m.overall_score >= 0.9
          ? "HIGH"
          : m.overall_score >= 0.7
          ? "MEDIUM"
          : "LOW",
    })
  )

  return NextResponse.json({
    matches: classified,
    submittedName: fullName,
    submittedDob: dateOfBirth,
    submittedGender: gender,
    nameNormalized,
    dobNormalized,
  })
}
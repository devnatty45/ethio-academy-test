// app/api/master/branches/route.ts
// Purpose: List all branches (accessible by both Master and Branch Admins) and create new ones
// Who can call it: GET is accessible by MASTER_ADMIN or BRANCH_ADMIN. POST is strictly MASTER_ADMIN.

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

/**
 * Validates that the logged-in user exists and holds an administrative role
 * capable of initiating or managing branch routing contexts.
 */
async function validateAdminSession(userId: string) {
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from("users")
    .select("id, role")
    .eq("id", userId)
    .single()

  if (error || !data) return null

  // Allow processing if the user is either a MASTER_ADMIN or a BRANCH_ADMIN
  if (data.role === "MASTER_ADMIN" || data.role === "BRANCH_ADMIN") {
    return data
  }

  return null
}

// GET — List all branches for transfer destination selection
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Validate that either role is accessing the endpoint
  const admin = await validateAdminSession(user.id)
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const adminClient = createAdminClient()
  const { data: branches, error } = await adminClient
    .from("branches")
    .select("id, name, code, is_active, created_at, updated_at")
    .order("name", { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch branches" },
      { status: 500 }
    )
  }

  return NextResponse.json({ branches: branches ?? [] })
}

// POST — Keep your original branch creation logic below this line
// Ensure your POST logic explicitly verifies (user.role === "MASTER_ADMIN") 
// so branch admins can only read (GET) the list, not write (POST) new branches!
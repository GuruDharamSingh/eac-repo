import type { NextRequest } from "next/server";
import { handleLogin } from "@elkdonis/auth-server";

// Wrapped, not `export { handleLogin as POST }`: the bare re-export form no
// longer type-checks against Next 16's route-handler signature (see
// HYGIENE_SWEEP_BRIEF_2026-09-03.md — that class was driven to zero repo-wide).
export async function POST(request: NextRequest) {
  return handleLogin(request);
}

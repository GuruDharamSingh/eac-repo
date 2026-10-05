import { NextResponse } from "next/server";
import { getViewer, type Viewer } from "@/lib/auth";

/**
 * The gate for the explorer's corpus APIs: org owners only, the same rule as
 * the studio (requireStudioReviewer). The statements digest books whose
 * licences are unknown, and votes become training labels. Returns the viewer,
 * or the response to send instead (401 signed out, 403 otherwise).
 */
export async function ownerOrResponse(): Promise<Viewer | NextResponse> {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in to see references" }, { status: 401 });
  if (viewer.role !== "owner") return NextResponse.json({ error: "References are for studio reviewers" }, { status: 403 });
  return viewer;
}

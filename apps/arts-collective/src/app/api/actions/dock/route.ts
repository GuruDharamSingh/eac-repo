import { NextResponse, type NextRequest } from "next/server";
import { dockData } from "@elkdonis/actions/server";
import { getActiveEnrolment, getCourseBySlug, getLearnerOutline, listMyEnrolments, stepTask } from "@elkdonis/lms";
import { getCurrentUser } from "@/lib/session";
import { ACTION_LINKS } from "@/lib/actions/links";

/**
 * GET /api/actions/dock?path=<the browser's path>  the dock's data for the signed-in
 * person (packages/actions/src/server/dock.ts; brief §3.3, slice 1). Reads only.
 * 401 signed out, 204 when there is nothing to show, else 200 with `{ step, post, links }`.
 *
 * A static segment: it takes precedence over app/api/actions/[id]; `dock` is not a
 * catalogue id.
 */
export const dynamic = "force-dynamic";

const LINKS = {
  ...ACTION_LINKS,
  nextcloud: (process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? "").replace(/\/$/, "") || undefined,
};

// The onboarding course (lib/lms/connectors.tsx ONBOARDING_COURSE_SLUG; not imported:
// that module pulls in the lesson's client components).
const COURSES = ["getting-started"];

const LMS = { getCourseBySlug, getActiveEnrolment, listMyEnrolments, getLearnerOutline, stepTask };

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const raw = req.nextUrl.searchParams.get("path");
  const path = raw && raw.startsWith("/") ? raw.slice(0, 600) : null;
  const data = await dockData({ userId: user.id, path, links: LINKS, lms: LMS, courses: COURSES });
  if (!data) return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

import { NextResponse, type NextRequest } from "next/server";
import { dockData } from "@elkdonis/actions/server";
import type { ActionStatus } from "@elkdonis/actions";
import {
  getActiveEnrolment,
  getCourseBySlug,
  getCourseTags,
  getLearnerOutline,
  listMyEnrolments,
  settleTaskStep,
  stepTask,
} from "@elkdonis/lms";
import { isAdmin } from "@elkdonis/auth-server";
import { getDockUser } from "@/lib/dock-user";
import { DOCK_LINKS } from "@/lib/dock-links";

/**
 * GET /api/actions/dock?path=<the browser's path>: the dock's data for the signed-in person on
 * Sophia (2026-11-27; same reader as arts-collective and the market, packages/actions/src/server/dock.ts).
 * Reads only. 401 signed out, 204 when there is nothing to show, else 200.
 *
 * Lessons live here, so `stepHref` is Sophia's own /<course>/<step>. Courses: the person's chosen
 * trail, else getting-started (the package default), then their other enrolments.
 */
export const dynamic = "force-dynamic";

const LMS = {
  getCourseBySlug,
  getActiveEnrolment,
  listMyEnrolments,
  getLearnerOutline,
  stepTask,
  getCourseTags,
  settleTask: (
    viewer: { userId: string | null; roles: Record<string, string> },
    input: { courseId: string; stepSlug: string; status: () => Promise<ActionStatus> },
  ) => settleTaskStep(viewer, { courseId: input.courseId, stepSlug: input.stepSlug, status: () => input.status() }),
};

const stepHref = (courseSlug: string, stepSlug: string) => `/${encodeURIComponent(courseSlug)}/${encodeURIComponent(stepSlug)}`;

export async function GET(req: NextRequest) {
  const user = await getDockUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const raw = req.nextUrl.searchParams.get("path");
  const path = raw && raw.startsWith("/") ? raw.slice(0, 600) : null;
  const rawTicket = req.nextUrl.searchParams.get("ticket");
  const ticket = rawTicket && /^[A-Za-z0-9_-]{1,16}$/.test(rawTicket) ? rawTicket : null;
  // Draft confirm wording shows only in dev/preview and to a global admin (wording waves, D-16).
  const confirmMode =
    process.env.NODE_ENV !== "production" || (await isAdmin(user.id).catch(() => false)) ? "draft-visible" : "live";
  const data = await dockData({
    userId: user.id,
    path,
    links: DOCK_LINKS,
    lms: LMS,
    confirmMode,
    ticket,
    stepHref,
    picker: req.nextUrl.searchParams.get("picker") === "1",
  });
  if (!data) return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

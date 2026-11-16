import { NextResponse, type NextRequest } from "next/server";
import { dockData } from "@elkdonis/actions/server";
import { getActiveEnrolment, getCourseBySlug, getCourseTags, getLearnerOutline, listMyEnrolments, stepTask } from "@elkdonis/lms";
import { settleTaskStep } from "@elkdonis/lms";
import { isAdmin } from "@elkdonis/auth-server";
import { getCurrentUser } from "@/lib/session";
import { ACTION_LINKS } from "@/lib/actions/links";
import { channelNextSource } from "@/lib/channel/next-source";

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

// The dock's default course is the package's own (getting-started); the person's chosen trail
// (lms_dock_state) comes first, so there is no course list here any more (DOCK_LOOP_SLICE1 §4.2).
// Course steps are welcome in the dock elsewhere; on Channel's own pages the ribbon carries the
// suggestions, so there the dock keeps to routine steps (owner, 2026-11-07).

// settleTask lets the dock record a step the person finished on a page outside the registry (lms tasks.ts).
const LMS = {
  getCourseBySlug, getActiveEnrolment, listMyEnrolments, getLearnerOutline, stepTask, getCourseTags,
  settleTask: (viewer: { userId: string | null; roles: Record<string, string> }, input: { courseId: string; stepSlug: string; status: () => Promise<import("@elkdonis/actions").ActionStatus> }) =>
    settleTaskStep(viewer, { courseId: input.courseId, stepSlug: input.stepSlug, status: () => input.status() }),
};

// The channel's next move on Channel's inner pages and in the Studio (server/dock.ts channelDockPath).
const SOURCES = { channelNext: channelNextSource };

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const raw = req.nextUrl.searchParams.get("path");
  const path = raw && raw.startsWith("/") ? raw.slice(0, 600) : null;
  const onChannel = Boolean(path && /^\/channel(\/|\?|$)/.test(path));
  const rawTicket = req.nextUrl.searchParams.get("ticket");
  const ticket = rawTicket && /^[A-Za-z0-9_-]{1,16}$/.test(rawTicket) ? rawTicket : null;
  // Draft confirm wording shows only in dev/preview and to a global admin (wording waves, D-16).
  const confirmMode = process.env.NODE_ENV !== "production" || (await isAdmin(user.id).catch(() => false)) ? "draft-visible" : "live";
  const data = await dockData({ userId: user.id, path, links: LINKS, lms: LMS, routinesOnly: onChannel, sources: SOURCES, confirmMode, ticket, picker: req.nextUrl.searchParams.get("picker") === "1" });
  if (!data) return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

import { cache } from "react";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";
import { getProfile, getViewerRoles } from "@elkdonis/services";
import { actionStatus, resolveActionOrg } from "@elkdonis/actions/server";
import { ACTION_LINKS } from "@/lib/actions/links";
import type { LmsConnectors, LmsHostViewer } from "@elkdonis/lms-ui";
import { TaskBox } from "@/components/learn/TaskBox";
import { forumBase } from "@/lib/elkdonis-hub";

/**
 * Sophia mounted on the network host, at /learn (lms/ORG_SITES.md;
 * ONBOARDING_COURSE_BRIEF_2026-10-29.md). The learner pages run here so a
 * course can open this host's own surfaces — profile, store, organisation,
 * payouts — from inside a step. Authoring stays on Sophia: studio links go
 * there. Media paths are /api/media/…, which this host serves the same way.
 */

const ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.ARTS_COLLECTIVE_URL ?? "http://localhost:3007").replace(/\/$/, "");
const SOPHIA = (process.env.NEXT_PUBLIC_SOPHIA_URL ?? "http://localhost:3020").replace(/\/$/, "");
const FORUM = forumBase();

/** The course signed-in visitors are enrolled in on first open, instead of pressing Begin. */
export const ONBOARDING_COURSE_SLUG = "getting-started";

const ANON: LmsHostViewer = { userId: null, roles: {}, name: null };

export const getLmsViewer = cache(async (): Promise<LmsHostViewer> => {
  try {
    const session = await getServerSession();
    if (!session.user) return ANON;
    const userId = session.user.db_user_id ?? session.user.id;
    const [roles, admin, profile] = await Promise.all([getViewerRoles(userId), isAdmin(userId), getProfile(userId).catch(() => null)]);
    return { userId, roles, isGlobalAdmin: admin, name: profile?.displayName ?? session.user.email?.split("@")[0] ?? null };
  } catch (err) {
    console.error("[learn] getLmsViewer:", err);
    return ANON;
  }
});

/** The org an `org` task acts on: `?org=` when the viewer may manage it, else the org they own (the registry's one rule, resolveActionOrg). */
const orgFor = cache(async (viewer: LmsHostViewer, requested: string | null): Promise<string | null> =>
  viewer.userId ? resolveActionOrg(viewer.userId, requested) : null);

/** One read per task per request: settleTaskStep and the box both ask (@elkdonis/actions). */
// `params` travels as a JSON string so React's cache keys on its value.
const taskStatus = cache((taskId: string, userId: string, orgId: string | null, params: string) =>
  actionStatus(taskId, { userId, orgId, links: ACTION_LINKS, params: params ? JSON.parse(params) : null }));

export const lmsConnectors: LmsConnectors = {
  viewer: getLmsViewer,
  site: { name: "Arts Collective", tagline: "Courses from the Elkdonis Arts Collective, taken at your own pace." },
  origin: ORIGIN,
  actionBase: "/api/lms",
  hrefs: {
    home: () => "/learn",
    course: (c) => `/learn/${c}`,
    step: (c, s) => `/learn/${c}/${s}`,
    journal: () => "/learn/journal",
    guide: (course) => `/learn/journal${course ? `?course=${encodeURIComponent(course)}` : ""}#to-answer`,
    care: () => "/learn/care",
    signIn: (next) => `/login?next=${encodeURIComponent(next)}`,
    forumThread: (id, slug) => `${FORUM}/t/${id}/${slug}`,
    // Authoring and the hub's own pages stay on Sophia.
    studio: () => `${SOPHIA}/studio`,
    studioCourse: (c) => `${SOPHIA}/studio/${c}`,
    studioStep: (c, id) => `${SOPHIA}/studio/${c}/${id}`,
    studioPool: (c) => `${SOPHIA}/studio/${c}/pool`,
    workshops: () => `${SOPHIA}/workshops`,
    studioWorkshops: () => `${SOPHIA}/studio/workshops`,
    side: (realm) => `${SOPHIA}/${realm}`,
    courses: () => "/learn",
    guides: () => `${SOPHIA}/guides`,
    traditions: () => `${SOPHIA}/traditions`,
    schedule: (week) => (week ? `${SOPHIA}/schedule?week=${week}` : `${SOPHIA}/schedule`),
    studioGuides: () => `${SOPHIA}/studio/guides`,
    studioTraditions: () => `${SOPHIA}/studio/traditions`,
    studioSchedule: () => `${SOPHIA}/studio/schedule`,
  },
  mediaUrl: (url) => url,
  tasks: {
    orgFor,
    status: (task, viewer, ctx) => (viewer.userId ? taskStatus(task.id, viewer.userId, task.scope === "org" ? ctx.orgId : null, task.params ? JSON.stringify(task.params) : "") : Promise.resolve({ done: false, detail: null })),
    render: TaskBox,
  },
};

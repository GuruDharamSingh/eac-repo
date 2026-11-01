import { cache } from "react";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";
import { getOnboardingTaskStatus, getOwnedOrgId, getProfile, getViewerRoles, ORG_TASK_IDS, canManageOrgPeople } from "@elkdonis/services";
import { db } from "@elkdonis/db";
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
const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
const NETWORK_PROTO = NETWORK_HOST.includes("localhost") ? "http" : "https";

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

/** The org an `org` task acts on: `?org=` when the viewer may manage it, else the org they own. */
const orgFor = cache(async (viewer: LmsHostViewer, requested: string | null): Promise<string | null> => {
  if (!viewer.userId) return null;
  if (requested && (await canManageOrgPeople(viewer.userId, requested))) return requested;
  return getOwnedOrgId(viewer.userId);
});

const orgSlug = cache(async (orgId: string): Promise<string | null> => {
  const [o] = await db<Array<{ slug: string }>>`SELECT slug FROM organizations WHERE id = ${orgId} LIMIT 1`;
  return o?.slug ?? null;
});

/** One read per task per request: settleTaskStep and the box both ask. */
const taskStatus = cache(async (taskId: string, userId: string, orgId: string | null) => {
  const s = await getOnboardingTaskStatus(taskId, userId, { orgId });
  // Hosts fill in where the finished thing lives.
  if (ORG_TASK_IDS.has(taskId) && orgId) {
    const slug = await orgSlug(orgId);
    if (slug) {
      if (taskId === "org-offering" || taskId === "org-people" || taskId === "org-details") s.href = `/hub/organization?org=${encodeURIComponent(slug)}`;
      if (taskId === "org-email") s.href = `/email?org=${encodeURIComponent(slug)}`;
      if (taskId === "org-site") s.href = `${NETWORK_PROTO}://${slug}.${NETWORK_HOST}/`;
    }
  }
  if (taskId === "listing" && s.href) s.href = `${(process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, "")}${s.href}`;
  return s;
});

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
    status: (task, viewer, ctx) => (viewer.userId ? taskStatus(task.id, viewer.userId, task.scope === "org" ? ctx.orgId : null) : Promise.resolve({ done: false, detail: null })),
    render: TaskBox,
  },
};

import {
  reviewThread,
  setOrgReview,
  listPendingThreads,
  setOrgStorePanels,
  reviewUserPage,
  listPendingUserPages,
} from "@elkdonis/services";
import { getIfacManager } from "@/lib/manage-auth";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";

/**
 * The submissions queue: threads waiting, store panels waiting, and the two
 * switches that decide whether anything waits at all.
 *
 * Two separate systems sharing one console, not one system: a thread's
 * switch (`review`) and a store panel's switch (`storePanels`) are different
 * columns on `organizations` with different defaults, for the reasons
 * user-pages.ts's own header explains — a panel is a designed section of the
 * org's OWN layout, not one row in a list. Both rules live in services
 * (moderation.ts / user-pages.ts); this route only says who is asking.
 * /manage's own gate lets editors in; both services re-check owner-or-guide
 * on every call, so a console bug cannot widen it.
 */
export async function GET() {
  const viewer = await getIfacManager();
  if (!viewer) return Response.json({ error: "Members only" }, { status: 403 });
  return Response.json({
    pending: await listPendingThreads(siteConfig.orgId),
    pendingPanels: await listPendingUserPages(siteConfig.orgId),
  });
}

export async function POST(request: Request) {
  const viewer = await getIfacManager();
  if (!viewer) return Response.json({ error: "Members only" }, { status: 403 });

  let body: {
    threadId?: string;
    decision?: string;
    review?: boolean;
    storePanels?: boolean;
    panelUserId?: string;
    panelKey?: string;
    panelDecision?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  // The thread switch: hold members' posts, or let them straight up.
  if (typeof body.review === "boolean") {
    const r = await setOrgReview(viewer.userId, siteConfig.orgId, body.review);
    if (r.ok === false) return Response.json({ error: r.error }, { status: 403 });
    return Response.json({ ok: true, review: r.on });
  }

  // The store-panel switch: host member-designed panels at all, or not.
  if (typeof body.storePanels === "boolean") {
    const r = await setOrgStorePanels(viewer.userId, siteConfig.orgId, body.storePanels);
    if (r.ok === false) return Response.json({ error: r.error }, { status: 403 });
    return Response.json({ ok: true, storePanels: r.on });
  }

  // A decision on a waiting store panel.
  if (body.panelUserId && body.panelKey) {
    const decision = body.panelDecision === "approve" ? "approve" : body.panelDecision === "reject" ? "reject" : null;
    if (!decision) return Response.json({ error: "Expected { panelUserId, panelKey, panelDecision }" }, { status: 400 });
    const r = await reviewUserPage(viewer.userId, body.panelUserId, siteConfig.orgId, body.panelKey, decision);
    if (r.ok === false) return Response.json({ error: r.error }, { status: 400 });
    return Response.json({ ok: true, status: r.status });
  }

  const decision = body.decision === "approve" ? "approve" : body.decision === "reject" ? "reject" : null;
  if (!body.threadId || !decision) {
    return Response.json({ error: "Expected { threadId, decision }" }, { status: 400 });
  }
  const r = await reviewThread(viewer.userId, body.threadId, decision);
  if (r.ok === false) return Response.json({ error: r.error }, { status: 400 });
  return Response.json({ ok: true, status: r.status });
}

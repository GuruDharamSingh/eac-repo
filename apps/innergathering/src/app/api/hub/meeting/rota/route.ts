import { NextRequest, NextResponse } from "next/server";
import {
  assignMeetingRole,
  clearMeetingRole,
  getMeetingRota,
  getRoleHolder,
  listRotaCandidates,
  setOccurrencePlan,
} from "@elkdonis/services";
// The route-handler viewer: returns null rather than redirecting, which is
// what a fetch from the surface needs (a 302 to /login inside a JSON fetch
// reads as a parse error, not as "sign in").
import { getApiMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { db } from "@elkdonis/db";

/**
 * The rota on a recurring gathering.
 *
 * READ is members-and-up: knowing who is hosting is most of the rota's value,
 * and four of the five people on it cannot edit the org. WRITE is editors —
 * with two deliberate exceptions: a plain member may put THEMSELVES down for
 * a role (host or co-host) on a coming occurrence, and may take themselves
 * back OFF a role they currently hold. Neither needs an owner, and neither
 * lets anyone touch somebody else's row.
 *
 * Every write checks the thread belongs to THIS org before touching it. The
 * service writes what it is told, by design, so the ownership check is the
 * route's job and skipping it would let a member of one org assign hosts on
 * another org's meeting.
 */
export const dynamic = "force-dynamic";

async function threadInOrg(threadId: string): Promise<boolean> {
  const [row] = await db<Array<{ id: string }>>`
    SELECT id FROM threads WHERE id = ${threadId} AND org_id = ${siteConfig.orgId}
  `;
  return Boolean(row);
}

export async function GET(request: NextRequest) {
  const viewer = await getApiMember();
  if (!viewer) return NextResponse.json({ error: "Members only" }, { status: 403 });

  const threadId = request.nextUrl.searchParams.get("threadId");
  if (!threadId) return NextResponse.json({ error: "threadId required" }, { status: 400 });
  if (!(await threadInOrg(threadId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Three weeks back as well as forward. A rota is not only a plan: the
  // occurrence you most want to write a note against is the one that has just
  // happened, and making the planner forward-only would mean a second door for
  // the other half of the same job.
  const from = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
  const [rota, candidates] = await Promise.all([
    getMeetingRota(threadId, { from, count: 11 }),
    listRotaCandidates(siteConfig.orgId),
  ]);

  return NextResponse.json({
    title: rota.title,
    occurrences: rota.occurrences.map((o) => ({
      at: o.at,
      isPast: o.isPast,
      host: o.host
        ? { userId: o.host.userId, displayName: o.host.displayName, note: o.host.note }
        : null,
      coHost: (() => {
        const c = o.roles.find((r) => r.role === "co-host");
        return c ? { userId: c.userId, displayName: c.displayName, note: c.note } : null;
      })(),
      hasRecord: o.hasRecord,
      plan: o.plan,
    })),
    candidates,
    canPlan: viewer.canEdit,
    // So the surface can tell "is this me" against host/co-host without a
    // second round trip, and offer self-serve controls to a plain member.
    viewerId: viewer.userId,
  });
}

export async function POST(request: NextRequest) {
  const viewer = await getApiMember();
  if (!viewer) return NextResponse.json({ error: "Members only" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    threadId?: string;
    occurrenceAt?: string;
    role?: string;
    userId?: string | null;
    /** What the week covers. Present means "write this", not "assign". */
    plan?: string | null;
  };

  const { threadId, occurrenceAt } = body;
  if (!threadId || !occurrenceAt)
    return NextResponse.json({ error: "threadId and occurrenceAt required" }, { status: 400 });
  if (!(await threadInOrg(threadId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // What the week is covering (migration 159). Handled FIRST and returned from:
  // a body carrying `plan` and no `userId` would otherwise fall through to the
  // clearing branch below and take the host off the week. An organiser may
  // write any week; that week's host or co-host may write theirs.
  if (body.plan !== undefined) {
    if (!viewer.canEdit) {
      const [host, coHost] = await Promise.all([
        getRoleHolder(threadId, occurrenceAt, "host"),
        getRoleHolder(threadId, occurrenceAt, "co-host"),
      ]);
      if (host !== viewer.userId && coHost !== viewer.userId) {
        return NextResponse.json(
          { error: "Only an organiser, or that week's host, can say what it covers." },
          { status: 403 }
        );
      }
    }
    await setOccurrencePlan({
      threadId,
      occurrenceAt,
      plan: body.plan,
      actorUserId: viewer.userId,
    });
    return NextResponse.json({ ok: true });
  }

  const role = body.role || "host";

  if (body.userId) {
    // An editor may assign anyone. A plain member may only put THEMSELVES
    // down — volunteering for a week (as host or co-host) should not need
    // an owner, but neither should anyone be able to sign up a colleague.
    const assigningSelf = body.userId === viewer.userId;
    if (!viewer.canEdit && !assigningSelf) {
      return NextResponse.json(
        { error: "Only an organiser can assign somebody else." },
        { status: 403 }
      );
    }
    await assignMeetingRole({
      threadId,
      occurrenceAt,
      role,
      userId: body.userId,
      actorUserId: viewer.userId,
    });
    return NextResponse.json({ ok: true });
  }

  // Clearing. An editor may clear anyone's row; a plain member may only step
  // themselves back off a role they currently hold — checked against the
  // database, never trusted from the request.
  if (viewer.canEdit) {
    await clearMeetingRole(threadId, occurrenceAt, role);
    return NextResponse.json({ ok: true });
  }
  const holder = await getRoleHolder(threadId, occurrenceAt, role);
  if (holder !== viewer.userId) {
    return NextResponse.json(
      { error: "Only an organiser can clear somebody else's spot." },
      { status: 403 }
    );
  }
  await clearMeetingRole(threadId, occurrenceAt, role);
  return NextResponse.json({ ok: true });
}

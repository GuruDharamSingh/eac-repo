import {
  answerWorkspaceEntry, commentOnWorkspaceEntry, completeWorkspaceStep, getWorkspaceJournal, makeMyWorkspaceEntriesPrivate, refreshWorkspaceDoing, saveWorkspaceResponse,
  setWorkspaceEntryVisibility, getOngoingView, saveIntervalEntry, saveIntervalPlan, getWorkspaceView, type MaterialItem, type ResponseVisibility,
  afterWithdrawalPublished, agreeToParticipation, decidePublication, getExperimentState, listResultCandidates, listResults, markResultPublished, markResultTakenDown,
  prepareResultsPublication, requestPublication, saveConsentText, saveResultDraft, withdrawParticipation,
  applyWorkspaceEdit, addWorkspaceMember, createWorkspace, createWorkspaceInvite, listOngoingSessions, listWorkspaceInvites, revokeWorkspaceInvite, searchWorkspaceMembers, type EditOp,
} from "@elkdonis/lms";
import { getViewer } from "@/lib/viewer";
import { connectors } from "@/lib/connectors";
import { createThread, moderateThread, updatePost } from "@elkdonis/services";
import { mapWorkspace } from "@elkdonis/workspace-ui/map";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
/** Archive a post this route just made (publish failed half way). Lifts a named run guide to the org guide role for this one call. */
async function archiveOwnPost(viewer: Awaited<ReturnType<typeof getViewer>>, course: string, threadId: string) {
  const w = await getWorkspaceView(viewer, course);
  const lifted = w ? { ...viewer, roles: { ...viewer.roles, [w.course.orgId]: viewer.roles[w.course.orgId] === "owner" ? "owner" as const : "guide" as const } } : viewer;
  await moderateThread(lifted, threadId, "delete");
}
const VIS = new Set(["me", "guide", "circle"]);

/**
 * The workspace screens' writes (slice 3a). JSON in, JSON out. It only calls the engine's own writes
 * (completeStep, saveResponse) through completeWorkspaceStep / saveWorkspaceResponse, which refuse anyone who is
 * not a seated, non-staff participant of that workspace. Same-origin only.
 */
export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return json({ ok: false, error: "Not allowed." }, 403);
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) return json({ ok: false, error: "Not allowed." }, 415);
  const viewer = await getViewer();
  if (!viewer.userId) return json({ ok: false, error: "Sign in first." }, 401);
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (action === "workspace-create" && b) {
    const orgId = typeof b.orgId === "string" ? b.orgId : "";
    const r = await createWorkspace(viewer, {
      orgId, title: typeof b.title === "string" ? b.title : "", line: typeof b.line === "string" ? b.line : "", when: typeof b.when === "string" ? b.when : "",
      where: b.where === "Online" || b.where === "Both" ? b.where : "In person", sessions: typeof b.sessions === "number" ? b.sessions : 1,
      ongoing: b.ongoing === true, experiment: b.experiment === true, consentText: typeof b.consentText === "string" ? b.consentText : undefined, visibility: b.visibility === "unlisted" ? "unlisted" : "private", join: b.join === "open" ? "open" : "invite",
    });
    return json(r, r.ok === false && r.error.startsWith("Only the organisation") ? 403 : 200);
  }
  const course = typeof b?.course === "string" ? b.course : "";
  const step = typeof b?.step === "string" ? b.step : "";
  const needsStep = !["journal", "private-all", "state", "ongoing", "ongoing-save", "ongoing-plan", "edit", "experiment", "experiment-agree", "experiment-withdraw", "consent-save", "results", "result-save", "result-request", "result-decide", "result-publish", "result-takedown", "members-search", "members-add", "invites", "invite-create", "invite-revoke"].includes(action);
  if (!b || !course || (needsStep && !step)) return json({ ok: false, error: "Missing details." }, 400);
  if (action === "edit") {
    const op = b.op as EditOp | undefined;
    if (!op || typeof op !== "object" || typeof (op as { t?: unknown }).t !== "string") return json({ ok: false, error: "Missing details." }, 400);
    const r = await applyWorkspaceEdit(viewer, course, op);
    if (r.ok === false) return json(r, r.error.startsWith("Only the guides") ? 403 : 200);
    const data = mapWorkspace(r.view, {
      viewerName: viewer.name, stepHref: (c, s) => connectors.hrefs.step(c, s), settings: r.view.settings, edit: true,
      ongoing: r.view.run ? await listOngoingSessions(r.view.run.id) : [],
    });
    return json({ ok: true, data: { course: data.course, people: data.people }, unpublished: r.view.unpublished, hasPublished: r.view.hasPublished, publish: r.publish });
  }
  if (action === "members-search") return json(await searchWorkspaceMembers(viewer, course, typeof b.q === "string" ? b.q : ""));
  if (action === "members-add") return json(await addWorkspaceMember(viewer, course, typeof b.userId === "string" ? b.userId : ""));
  if (action === "invites") { const l = await listWorkspaceInvites(viewer, course); return l ? json({ ok: true, invites: l }) : json({ ok: false, error: "Not available." }, 403); }
  if (action === "invite-create") return json(await createWorkspaceInvite(viewer, course, { label: typeof b.label === "string" ? b.label : undefined, maxUses: typeof b.maxUses === "number" ? b.maxUses : null, days: typeof b.days === "number" ? b.days : null }));
  if (action === "invite-revoke") return json(await revokeWorkspaceInvite(viewer, course, typeof b.id === "string" ? b.id : ""));
  if (action.startsWith("experiment") || action.startsWith("consent-") || action.startsWith("result")) {
    // The experiment preset (migrations 288 and 289). Consent and decisions are the person's own; everything about results is the guides'.
    if (action === "experiment") {
      const s = await getExperimentState(viewer, course);
      if (!s) return json({ ok: false, error: "Not available." }, 403);
      return json({ ok: true, state: { ...s, published: s.published.map((p) => ({ id: p.id, title: p.title, threadId: p.threadId, href: p.threadSlug ? connectors.hrefs.forumThread(p.threadId, p.threadSlug) : null, publishedAt: p.publishedAt })) } });
    }
    if (action === "experiment-agree") return json(await agreeToParticipation(viewer, course));
    if (action === "experiment-withdraw") {
      const r = await withdrawParticipation(viewer, course);
      // A published post must lose this person's entries too: re-render it from what is still valid, or take it down if nothing is left.
      const notes: string[] = [];
      if (r.ok && r.rerender?.length) {
        const view = await getWorkspaceView(viewer, course);
        for (const t of r.rerender) {
          const again = view?.run ? await afterWithdrawalPublished(view.run.id, t.resultId) : null;
          if (!again || !view) continue;
          if (again.empty) { await updatePost(t.threadId, view.course.orgId, { body: again.bodyHtml }); notes.push(`The published results "${t.title}" have no entries left: the guides should take them down.`); }
          else { await updatePost(t.threadId, view.course.orgId, { body: again.bodyHtml }); notes.push(`The published results "${t.title}" were updated without this person's entries.`); }
        }
      }
      return json({ ...r, notes });
    }
    if (action === "consent-save") return json(await saveConsentText(viewer, course, typeof b.body === "string" ? b.body : ""));
    if (action === "results") {
      const results = await listResults(viewer, course);
      if (!results) return json({ ok: false, error: "Not available." }, 403);
      const rid = typeof b.resultId === "string" ? b.resultId : results.find((r) => r.status === "draft")?.id;
      return json({ ok: true, results, candidates: (await listResultCandidates(viewer, course, rid)) ?? [] });
    }
    if (action === "result-save") {
      const r = await saveResultDraft(viewer, course, { id: typeof b.id === "string" ? b.id : undefined, title: typeof b.title === "string" ? b.title : "", intro: typeof b.intro === "string" ? b.intro : "", conclusion: typeof b.conclusion === "string" ? b.conclusion : "", audience: b.audience === "everyone" ? "everyone" : "members" });
      return json(r);
    }
    if (action === "result-request") return json(await requestPublication(viewer, course, typeof b.id === "string" ? b.id : "", Array.isArray(b.responseIds) ? (b.responseIds as unknown[]).filter((x): x is string => typeof x === "string") : []));
    if (action === "result-decide") return json(await decidePublication(viewer, course, typeof b.itemId === "string" ? b.itemId : "", b.decision === "agree" ? "agree" : "decline", b.credit === "named" ? "named" : "anonymous"));
    if (action === "result-publish") {
      const resultId = typeof b.id === "string" ? b.id : "";
      const p = await prepareResultsPublication(viewer, course, resultId);
      if (p.ok === false) return json(p);
      // The thread is made ONLY here, only now, only from agreed entries. Members-only by default; "everyone" is a PUBLIC post on the organisation's pages.
      const post = await createThread({
        kind: "post", title: p.prepared.title, orgId: p.prepared.orgId, authorId: p.prepared.authorId, body: p.prepared.bodyHtml,
        status: "published", visibility: p.prepared.audience === "everyone" ? "PUBLIC" : "ORGANIZATION", metadata: { experimentResult: { resultId } },
      });
      const m = await markResultPublished(viewer, course, resultId, post.id);
      if (m.ok === false) { await archiveOwnPost(viewer, course, post.id); return json(m); }
      return json({ ok: true, threadId: post.id, slug: post.slug, audience: p.prepared.audience, included: p.prepared.included });
    }
    if (action === "result-takedown") {
      const t = await markResultTakenDown(viewer, course, typeof b.id === "string" ? b.id : "");
      if (t.ok === false) return json(t);
      if (t.threadId) {
        // Archive the post. A named run guide who is not an org guide is lifted to the org guide role for this one call, after the gate above.
        const w = await getWorkspaceView(viewer, course);
        const lifted = w ? { ...viewer, roles: { ...viewer.roles, [w.course.orgId]: viewer.roles[w.course.orgId] === "owner" ? "owner" as const : "guide" as const } } : viewer;
        const m = await moderateThread(lifted, t.threadId, "delete");
        if (m.ok === false) return json({ ok: false, error: "The results were marked taken down, but the post could not be archived: " + m.error });
      }
      return json({ ok: true });
    }
  }
  if (action === "ongoing" || action === "ongoing-save" || action === "ongoing-plan") {
    const moduleId = typeof b.module === "string" ? b.module : "";
    const tz = typeof b.tz === "string" ? b.tz : null;
    if (!moduleId) return json({ ok: false, error: "Missing details." }, 400);
    if (action === "ongoing-save") {
      const visibility = typeof b.visibility === "string" && VIS.has(b.visibility) ? (b.visibility as ResponseVisibility) : undefined;
      const r = await saveIntervalEntry(viewer, course, moduleId, {
        body: typeof b.body === "string" ? b.body : "", minutes: typeof b.minutes === "number" ? b.minutes : undefined,
        visibility, key: typeof b.key === "string" && b.key ? b.key : undefined, tz,
      });
      return json(r.ok ? { ok: true, ongoing: r.view } : r);
    }
    if (action === "ongoing-plan") {
      const w = await getWorkspaceView(viewer, course);
      if (!w?.run) return json({ ok: false, error: "Not available." }, 403);
      const r = await saveIntervalPlan(viewer, w.run.id, moduleId, typeof b.key === "string" ? b.key : "", { note: typeof b.note === "string" ? b.note : null, items: Array.isArray(b.items) ? (b.items as MaterialItem[]) : [] });
      if (r.ok === false) return json(r);
    }
    const v = await getOngoingView(viewer, course, moduleId, tz);
    return v ? json({ ok: true, ongoing: v }) : json({ ok: false, error: "You are not in this group." }, 403);
  }
  if (action === "journal") {
    const j = await getWorkspaceJournal(viewer, course);
    return j ? json({ ok: true, journal: j }) : json({ ok: false, error: "You are not in this group." }, 403);
  }
  if (action === "visibility") {
    const vis = typeof b.visibility === "string" && VIS.has(b.visibility) ? (b.visibility as ResponseVisibility) : null;
    return vis ? json(await setWorkspaceEntryVisibility(viewer, course, step, vis)) : json({ ok: false, error: "Pick who can read it." }, 400);
  }
  if (action === "state") return json(await refreshWorkspaceDoing(viewer, course));
  if (action === "private-all") return json(await makeMyWorkspaceEntriesPrivate(viewer, course));
  if (action === "comment") {
    const text = typeof b.body === "string" ? b.body : "";
    // Everyone in the group (guides included) comments the same way, as the mock-ups show. No email is sent from here.
    const r = await commentOnWorkspaceEntry(viewer, course, step, text);
    if (r.ok === true || !r.error.startsWith("Comments from the group are not")) return json(r);
    // Until migration 284 is applied, a guide's words are kept as the engine's own answer (still no email).
    const a = await answerWorkspaceEntry(viewer, course, step, text);
    return json(a.ok ? a : r);
  }
  if (action === "complete") return json(await completeWorkspaceStep(viewer, course, step));
  if (action === "respond") {
    const kind = b.kind === "practice_log" ? "practice_log" : "reflection";
    const visibility = typeof b.visibility === "string" && VIS.has(b.visibility) ? (b.visibility as ResponseVisibility) : undefined;
    const r = await saveWorkspaceResponse(viewer, course, {
      stepId: step, kind, body: typeof b.body === "string" ? b.body : "", visibility, responseId: typeof b.response === "string" ? b.response : undefined,
    });
    return json(r);
  }
  return json({ ok: false, error: "Not found." }, 404);
}

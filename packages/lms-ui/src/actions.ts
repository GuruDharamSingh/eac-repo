import {
  acknowledge, adoptLatestVersion, completeStep, deleteResponse, enrol, getCourseBySlug, getRun, ensureDefaultRun,
  openRunDiscussions, saveResponse, waiveStep, withdraw,
  type ResponseKind, type ResponseVisibility,
} from "@elkdonis/lms";
import {
  addRunGuideByEmail, createCourse, createRun, editOutline, getCourseById, publishCourse, syncWorkshopEnrolments, updateCourse,
  updateRun, upsertStepDraft, canEditCourse, getDraft, addToPool, updatePoolItem, usePoolItem, type CourseVisibility, type OutlineOp, type RunMode, type StepMedia, type UnlockRule,
} from "@elkdonis/lms";
import type { LmsConnectors } from "./connectors";

const ACTIONS = new Set(["begin", "complete", "respond", "delete-response", "acknowledge", "waive", "open-discussions", "adopt", "withdraw",
  "studio-create-course", "studio-save-course", "studio-outline", "studio-save-step", "studio-publish", "studio-create-run", "studio-save-run", "studio-add-guide", "studio-sync-rsvps", "studio-upload", "pool-add", "pool-edit", "pool-use"]);

const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === "string" ? v.trim() : ""; };

/** Only ever a path on this host. */
function safeBack(raw: string, fallback: string): string {
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}
function withQuery(path: string, q: Record<string, string | null>): string {
  const [base, hash = ""] = path.split("#");
  const u = new URL(base, "http://x");
  for (const [k, v] of Object.entries(q)) { if (v === null) u.searchParams.delete(k); else u.searchParams.set(k, v); }
  return `${u.pathname}${u.search}${hash ? `#${hash}` : ""}`;
}
const redirect = (to: string) => new Response(null, { status: 303, headers: { Location: to } });

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/**
 * The no-JavaScript body field. Markup is kept (it is sanitised on save);
 * plain text becomes paragraphs, with "## " headings, "> " quotes and "- " lists.
 */
export function textToHtml(text: string): string {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t || /<\/?(p|h[1-6]|ul|ol|li|blockquote|div|br|em|strong|a|img|figure|table)\b/i.test(t)) return t;
  return t.split(/\n{2,}/).map((block) => {
    const lines = block.split("\n");
    if (lines.every((l) => /^[-*] /.test(l))) return `<ul>${lines.map((l) => `<li>${esc(l.slice(2))}</li>`).join("")}</ul>`;
    if (lines.every((l) => /^> ?/.test(l))) return `<blockquote><p>${lines.map((l) => esc(l.replace(/^> ?/, ""))).join("<br>")}</p></blockquote>`;
    if (/^### /.test(block)) return `<h3>${esc(block.slice(4))}</h3>`;
    if (/^## /.test(block)) return `<h2>${esc(block.slice(3))}</h2>`;
    return `<p>${lines.map(esc).join("<br>")}</p>`;
  }).join("\n");
}
/** Accepts a thread id, or any forum URL containing /t/<id>/. */
const threadIdFrom = (raw: string) => raw.match(/\/t\/([^/?#]+)/)?.[1] ?? raw;
const dateOrNull = (raw: string) => { if (!raw) return null; const d = new Date(raw); return Number.isNaN(d.getTime()) ? null : d; };

/**
 * Every form in Sophia posts here: <actionBase>/<action>. Plain form posts and
 * 303s, so the whole platform works with JavaScript off.
 */
export async function handleLmsAction({ request, action, connectors }: { request: Request; action: string; connectors: LmsConnectors }): Promise<Response> {
  if (request.method !== "POST" || !ACTIONS.has(action)) return new Response("Not found", { status: 404 });
  const fd = await request.formData();
  const { hrefs } = connectors;
  const back = safeBack(str(fd, "back"), hrefs.home());
  const fail = (error: string) => redirect(withQuery(back, { error, notice: null }));
  const done = (to: string, notice?: string) => redirect(withQuery(to, { notice: notice ?? null, error: null }));

  const viewer = await connectors.viewer();
  if (!viewer.userId) return redirect(hrefs.signIn(back));

  switch (action) {
    case "begin": {
      let runId = str(fd, "run");
      if (!runId) {
        const course = await getCourseBySlug(str(fd, "course"));
        const run = course ? await ensureDefaultRun(course) : null;
        if (!run) return fail("That course isn’t open yet.");
        runId = run.id;
      }
      const r = await enrol(viewer, runId);
      if (r.ok === false) return fail(r.error);
      return done(back, r.isNew ? "Welcome. Your place is kept from here on." : undefined);
    }
    case "complete": {
      const r = await completeStep(viewer, str(fd, "enrolment"), str(fd, "step"));
      if (r.ok === false) return fail(r.error);
      return done(safeBack(str(fd, "next"), back), r.courseCompleted ? "You have walked the whole of it." : undefined);
    }
    case "respond": {
      const alsoComplete = str(fd, "also") === "complete";
      if (alsoComplete) {
        // The loud button lives in the same form as the words: keep them if there are any, then complete.
        if (str(fd, "body")) {
          const saved = await saveResponse(viewer, { enrolmentId: str(fd, "enrolment"), stepId: str(fd, "step"), body: str(fd, "body"), kind: (str(fd, "kind") || "reflection") as ResponseKind, visibility: (str(fd, "visibility") || undefined) as ResponseVisibility | undefined });
          if (saved.ok === false) return fail(saved.error);
        }
        const c2 = await completeStep(viewer, str(fd, "enrolment"), str(fd, "step"));
        if (c2.ok === false) return fail(c2.error);
        return done(safeBack(str(fd, "next"), back), c2.courseCompleted ? "You have walked the whole of it." : undefined);
      }
      const r = await saveResponse(viewer, {
        enrolmentId: str(fd, "enrolment"), stepId: str(fd, "step"), body: str(fd, "body"),
        kind: (str(fd, "kind") || "reflection") as ResponseKind,
        visibility: (str(fd, "visibility") || undefined) as ResponseVisibility | undefined,
        responseId: str(fd, "response") || undefined,
      });
      if (r.ok === false) return fail(r.error);
      const kind = str(fd, "kind");
      return done(`${back.split("#")[0]}#${kind === "note" ? "guide" : "reflection"}`, r.courseCompleted ? "You have walked the whole of it." : kind === "note" ? "Sent to your guide, and only to them." : "Kept.");
    }
    case "delete-response": {
      const r = await deleteResponse(viewer, str(fd, "response"));
      return r.ok === false ? fail(r.error) : done(back, "Removed.");
    }
    case "acknowledge": {
      const r = await acknowledge(viewer, str(fd, "response"), { body: str(fd, "body") });
      if (r.ok === false) return fail(r.error);
      if (connectors.notifyAcknowledged && r.notify.learnerId !== viewer.userId) {
        const url = `${connectors.origin}${hrefs.step(r.notify.courseSlug, r.notify.stepSlug)}#reflection`;
        void connectors.notifyAcknowledged(r.notify, url).catch((e) => console.error("[lms] notifyAcknowledged:", e));
      }
      return done(back, "Answered.");
    }
    case "waive": {
      const r = await waiveStep(viewer, str(fd, "enrolment"), str(fd, "step"));
      return r.ok === false ? fail(r.error) : done(back, "Set aside for them.");
    }
    case "open-discussions": {
      if (!connectors.createDiscussionThread) return fail("This site can’t open forum conversations.");
      const run = await getRun(str(fd, "run"));
      const courseSlug = str(fd, "course");
      if (!run) return fail("No such run.");
      const r = await openRunDiscussions(viewer, run.id, connectors.createDiscussionThread, (s) => `${connectors.origin}${hrefs.step(courseSlug, s)}`);
      return r.ok === false ? fail(r.error) : done(back, r.opened ? `Opened ${r.opened} conversation${r.opened === 1 ? "" : "s"}.` : "Every step already has its conversation.");
    }
    case "adopt": {
      const r = await adoptLatestVersion(viewer, str(fd, "run"));
      return r.ok === false ? fail(r.error) : done(back, "This group now follows the latest version.");
    }
    case "withdraw": {
      const r = await withdraw(viewer, str(fd, "enrolment"));
      return r.ok === false ? fail(r.error) : done(hrefs.home(), "You’ve stepped out. What you wrote is still yours, in your journal.");
    }
    case "studio-create-course": {
      const r = await createCourse(viewer, { orgId: str(fd, "org"), title: str(fd, "title"), summary: str(fd, "summary") || null, visibility: "private" });
      return r.ok === false ? fail(r.error) : done(hrefs.studioCourse(r.course.slug), "Started. It is private until you say otherwise.");
    }
    case "studio-save-course": {
      const r = await updateCourse(viewer, str(fd, "course"), {
        title: str(fd, "title"), slug: str(fd, "slug") || undefined, summary: str(fd, "summary") || null,
        descriptionHtml: textToHtml(str(fd, "description")), visibility: (str(fd, "visibility") || undefined) as CourseVisibility | undefined,
      });
      if (r.ok === false) return fail(r.error);
      const c = await getCourseById(str(fd, "course"));
      return done(c ? hrefs.studioCourse(c.slug) : back, "Saved. Title, summary and description reach readers when you publish; the address and who-can-see-it apply now.");
    }
    case "studio-outline": {
      const kind = str(fd, "op");
      const dir = str(fd, "dir") === "-1" ? -1 : 1;
      const rule = str(fd, "rule");
      const unlock: UnlockRule =
        rule === "open" ? { kind: "open" } : rule === "after_module" ? { kind: "after_module", moduleId: str(fd, "after") }
        : rule === "date" ? { kind: "date", at: dateOrNull(str(fd, "at"))?.toISOString() ?? "" } : rule === "offset_days" ? { kind: "offset_days", days: Number(str(fd, "days")) }
        : { kind: "sequential" };
      const ops: Record<string, OutlineOp> = {
        "add-module": { op: "add-module", title: str(fd, "title") },
        "edit-module": { op: "edit-module", moduleId: str(fd, "module"), title: str(fd, "title"), summary: str(fd, "summary") },
        "remove-module": { op: "remove-module", moduleId: str(fd, "module") },
        "move-module": { op: "move-module", moduleId: str(fd, "module"), dir },
        "add-step": { op: "add-step", moduleId: str(fd, "module"), title: str(fd, "title"), type: str(fd, "type") },
        "move-step": { op: "move-step", stepId: str(fd, "step"), dir },
        "send-step": { op: "send-step", stepId: str(fd, "step"), moduleId: str(fd, "module") },
        "remove-step": { op: "remove-step", stepId: str(fd, "step") },
        "set-rule": { op: "set-rule", stepId: str(fd, "step"), required: str(fd, "required") === "1", unlock },
      };
      if (!ops[kind]) return fail("Unknown change.");
      const r = await editOutline(viewer, str(fd, "course"), ops[kind]);
      if (r.ok === false) return fail(r.error);
      return kind === "add-step" && r.stepId ? done(hrefs.studioStep(str(fd, "courseSlug"), r.stepId)) : done(back);
    }
    case "studio-save-step": {
      const media: StepMedia[] = [];
      for (let i = 0; i < 12; i++) {
        const url = str(fd, `media_url_${i}`);
        if (!url) continue;
        const k = str(fd, `media_kind_${i}`);
        media.push({ kind: (["audio", "video", "image", "file"].includes(k) ? k : "file") as StepMedia["kind"], url, title: str(fd, `media_title_${i}`) || undefined, transcript: str(fd, `media_transcript_${i}`) || undefined });
      }
      const threadId = threadIdFrom(str(fd, "thread"));
      const minutes = Number(str(fd, "minutes"));
      // Links come from the pool, not from this form: keep the ones not ticked for removal.
      const before = (await getDraft(viewer, str(fd, "course")))?.steps.find((x) => x.stepId === str(fd, "step"));
      const dropLinks = new Set(fd.getAll("drop_link").map(String));
      const links = (before?.refs.links ?? []).filter((l) => !dropLinks.has(l.url));
      const r = await upsertStepDraft(viewer, str(fd, "course"), {
        stepId: str(fd, "step"), title: str(fd, "title"), slug: str(fd, "slug") || undefined, type: str(fd, "type") || undefined,
        summary: str(fd, "summary") || null, bodyHtml: textToHtml(str(fd, "body")),
        settings: { ...(minutes > 0 ? { minutes } : {}), ...(str(fd, "practice") ? { practice: str(fd, "practice") } : {}), ...(str(fd, "alternative") ? { alternative: str(fd, "alternative") } : {}), ...(str(fd, "prompt") ? { prompt: str(fd, "prompt") } : {}) },
        refs: { ...(threadId ? { threadId } : {}), ...(media.length ? { media } : {}), ...(links.length ? { links } : {}) },
      });
      return r.ok === false ? fail(r.error) : done(back, "Saved to the working copy. Readers see it when you publish.");
    }
    case "studio-upload": {
      if (!connectors.uploadMedia) return fail("This site only takes links to files.");
      const course = await getCourseById(str(fd, "course"));
      if (!course || !(await canEditCourse(viewer, course))) return fail("You can’t edit this course.");
      const file = fd.get("file");
      if (!(file instanceof File) || file.size === 0) return fail("Choose a file first.");
      const draft = await getDraft(viewer, course.id);
      const step = draft?.steps.find((x) => x.stepId === str(fd, "step"));
      if (!step) return fail("No such step.");
      const up = await connectors.uploadMedia({ orgId: course.orgId, uploaderId: viewer.userId, file });
      if (up.ok === false) return fail(up.error);
      const media = [...(step.refs.media ?? []), { kind: up.kind, url: up.url, title: str(fd, "title") || up.name, transcript: str(fd, "transcript") || undefined }];
      const r = await upsertStepDraft(viewer, course.id, { stepId: step.stepId, title: step.title, refs: { ...step.refs, media } });
      return r.ok === false ? fail(r.error) : done(`${back.split("#")[0]}#media`, "Uploaded and added to this step’s working copy.");
    }
    case "pool-add": {
      const mediaUrl = str(fd, "media_url");
      const r = await addToPool(viewer, str(fd, "course"), {
        input: str(fd, "input"), note: str(fd, "note"), tags: str(fd, "tags"),
        media: mediaUrl ? { url: mediaUrl, kind: (str(fd, "media_kind") || "file") as StepMedia["kind"], title: str(fd, "media_title") } : undefined,
      });
      if (r.ok === false) return fail(r.error);
      return done(`${back.split("#")[0]}#p-${r.itemId}`, r.duplicate ? "That’s already in the pool." : r.kind === "note" ? "Noted." : "Added to the pool.");
    }
    case "pool-edit": {
      const r = await updatePoolItem(viewer, str(fd, "item"), { title: str(fd, "title"), note: str(fd, "note"), tags: str(fd, "tags"), archive: str(fd, "archive") === "1" });
      return r.ok === false ? fail(r.error) : done(back, str(fd, "archive") === "1" ? "Taken out of the pool. Steps already using it keep it." : "Saved.");
    }
    case "pool-use": {
      const target = str(fd, "target"); // "step:<id>" or "module:<id>"
      const [kind, id] = target.split(":");
      const r = await usePoolItem(viewer, str(fd, "item"), kind === "step" ? { stepId: id } : { moduleId: id });
      if (r.ok === false) return fail(r.error);
      return done(kind === "module" ? hrefs.studioStep(str(fd, "courseSlug"), r.stepId) : back, kind === "module" ? "A new step, made from the pool. Shape it, then publish." : "Added to that step’s working copy.");
    }
    case "studio-publish": {
      const r = await publishCourse(viewer, str(fd, "course"), str(fd, "notes") || undefined);
      if (r.ok === false) return fail(r.error);
      return done(back, r.changeKind === "fix"
        ? `Published version ${r.versionNo}. Wording only — everyone already enrolled sees it now.`
        : `Published version ${r.versionNo}. The shape changed, so groups already under way keep their version until their guide moves them.`);
    }
    case "studio-create-run": {
      const r = await createRun(viewer, str(fd, "course"), {
        title: str(fd, "title"), mode: (str(fd, "mode") || "cohort") as RunMode, startsAt: dateOrNull(str(fd, "starts")), capacity: Number(str(fd, "capacity")) || null,
        workshopThreadId: threadIdFrom(str(fd, "thread")) || null, discussionFeed: str(fd, "feed") || null, guideIds: [viewer.userId],
      });
      return r.ok === false ? fail(r.error) : done(back, "Group opened. You are its guide.");
    }
    case "studio-save-run": {
      const r = await updateRun(viewer, str(fd, "run"), {
        title: str(fd, "title") || undefined, status: (str(fd, "status") || undefined) as never, startsAt: dateOrNull(str(fd, "starts")), capacity: Number(str(fd, "capacity")) || null,
        enrolPolicy: (str(fd, "policy") || undefined) as never, defaultVisibility: (str(fd, "vis") || undefined) as never,
        workshopThreadId: threadIdFrom(str(fd, "thread")) || null, discussionFeed: str(fd, "feed") || null,
      });
      return r.ok === false ? fail(r.error) : done(back, "Saved.");
    }
    case "studio-add-guide": {
      const r = await addRunGuideByEmail(viewer, str(fd, "run"), str(fd, "email"));
      return r.ok === false ? fail(r.error) : done(back, "They can now see this group’s guide desk.");
    }
    case "studio-sync-rsvps": {
      const r = await syncWorkshopEnrolments(viewer, str(fd, "run"));
      return r.ok === false ? fail(r.error) : done(back, r.added ? `Brought in ${r.added} ${r.added === 1 ? "person" : "people"} from the gathering’s RSVPs.` : "Everyone who RSVP’d is already in.");
    }
  }
  return new Response("Not found", { status: 404 });
}

// Server side, no React: the learning system's data -> the screens' Course shape. Types only come from @elkdonis/lms,
// so this file never reaches the database by itself. Mounted by the host's server page (Sophia's /workspaces/[slug]).
import type { OngoingSession, PublishedStep, WorkspaceDoing, WorkspaceSettings, WorkspaceView } from "@elkdonis/lms";
import { stepTypeDef } from "@elkdonis/lms/step-types";
import type { ServerWorkspaceData } from "./server";
import type { Course, DoingData, Module, Ongoing, Person, Step, StepKind } from "./types";
import { PALETTE } from "./sample";

const KIND: Record<string, StepKind> = {
  reading: "reading", practice: "practice", reflection: "reflection", session: "gathering", thread: "conversation", resource: "resource", task: "setup",
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((x) => x[0]).slice(0, 2).join("").toUpperCase() || "?";
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);

/** Step HTML back to the plain text the editing box shows: paragraphs separated by blank lines. */
function htmlToText(h: string | null | undefined): string {
  return (h ?? "")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function mapStep(s: PublishedStep, stepHref: (stepSlug: string) => string, edit = false): Step {
  const set = s.settings ?? {};
  return {
    id: s.stepId,
    kind: KIND[s.type] ?? "reading",
    title: s.title,
    prompt: edit ? text(s.type === "practice" ? set.practice : set.prompt) : text(set.prompt) ?? text(set.practice),
    required: s.required,
    completion: stepTypeDef(s.type).completion,
    doneLabel: stepTypeDef(s.type).doneLabel,
    bodyHtml: s.bodyHtml ?? undefined,
    summary: s.summary ?? undefined,
    minutes: typeof set.minutes === "number" ? set.minutes : undefined,
    due: text(set.due),
    when: text(set.when),
    where: text(set.where),
    media: (s.refs?.media ?? []).map((m) => ({ kind: m.kind, url: m.url, title: m.title })),
    links: (s.refs?.links ?? []).map((l) => ({ url: l.url, title: l.title })),
    openHref: stepHref(s.slug),
    ...(edit ? { body: htmlToText(s.bodyHtml), timeLimit: typeof set.minutes === "number" ? set.minutes : undefined, href: s.refs?.links?.[0]?.url, fileName: s.refs?.links?.[0]?.title } : {}),
  };
}

export interface MapOptions {
  /** The viewer's own display name. */
  viewerName: string | null;
  /** Address of one step's own page on the host. */
  stepHref: (courseSlug: string, stepSlug: string) => string;
  now?: Date;
  /** Module id to open first. */
  initialModule?: string;
  /** Ongoing sessions of the run (empty until migration 285 exists). */
  ongoing?: OngoingSession[];
  /** The workspace's stored settings (call link, who comments, email choices). */
  settings?: WorkspaceSettings;
  /** Map the DRAFT for a guide who is editing (plain-text bodies, the run's own journal default). */
  edit?: boolean;
}

/** A view that has nothing to draw (no run, or nothing published) maps to `course: null`; the screens say so in plain words. */
export function mapWorkspace(v: WorkspaceView, o: MapOptions): ServerWorkspaceData {
  const guides: Person[] = v.guides.map((g) => ({ id: g.id, name: g.name, initials: initials(g.name), role: "guide" }));
  const guideIds = new Set(guides.map((g) => g.id));
  // The roster is staff only (the read returns null for anyone else). Ids are the seat ids, not user ids.
  const learners: Person[] = (v.roster ?? [])
    .filter((r) => !guideIds.has(r.userId))
    .map((r) => ({ id: r.enrolmentId, name: r.name, initials: initials(r.name), role: "participant" as const }));
  const people = v.isStaff ? [...guides, ...learners] : guides;
  const viewer: Person = { id: "viewer", name: o.viewerName ?? "You", initials: initials(o.viewerName ?? "You"), role: v.isStaff ? "guide" : "participant" };

  let course: Course | null = null;
  if (v.published && v.run) {
    const pc = v.published;
    const sess = new Map((o.ongoing ?? []).map((s) => [s.moduleId, s]));
    const modules: Module[] = pc.modules.map((m, i) => {
      const lk = m.look ?? {};
      return {
        id: m.id, title: m.title, description: lk.description ?? m.summary ?? undefined,
        date: lk.date, length: lk.length, coverLabel: lk.coverLabel, coverUrl: lk.coverUrl,
        colour: lk.colour ?? PALETTE[i % PALETTE.length],
        fill: { row: true, pane: true, title: true, buttons: true },
        materials: (lk.materials ?? []).map((x) => ({ id: x.id, name: x.name, access: x.access, url: x.url })),
        ...(sess.get(m.id) ? { kind: "ongoing" as const, ongoing: ongoingOf(sess.get(m.id)!) } : { kind: "standard" as const }),
        steps: m.steps.map((s) => mapStep(s, (slug) => o.stepHref(v.course.slug, slug), o.edit)),
      };
    });
    const dates = modules.map((m) => m.date).filter((d): d is string => Boolean(d));
    course = {
      id: v.course.id, orgName: v.course.orgName, title: pc.course.title, line: pc.course.summary ?? "", price: "Free", when: dates.length > 1 ? `${dates[0]} to ${dates[dates.length - 1]}` : dates[0] ?? "", where: "Online", peopleCount: v.isStaff ? learners.length : undefined,
      about: o.edit ? htmlToText(pc.course.descriptionHtml) : pc.course.summary ?? "", aboutHtml: o.edit ? undefined : pc.course.descriptionHtml ?? undefined,
      bannerUrl: pc.course.coverUrl ?? undefined,
      guideId: guides[0]?.id ?? "",
      modules,
      journals: o.edit ? (v.run.defaultVisibility === "circle" ? "shared" : "private") : "shared", journalComments: o.settings?.commentsBy ?? "everyone", callLink: o.settings?.callUrl ?? "",
      status: v.run.status === "open" ? "published" : "draft",
      pacing: pacingOf(pc.steps), endDate: v.run.endsAt ? (o.edit ? v.run.endsAt.toISOString().slice(0, 10) : v.run.endsAt.toISOString()) : null, join: v.run.enrolPolicy,
      emails: o.settings?.emails ?? { to: "guide", when: "each", remind: false },
    };
  }
  return { course, people, viewer, mode: v.isStaff ? "guide" : "participant", now: (o.now ?? new Date()).toISOString(), initialModule: o.initialModule };
}

/** The participant's own state as plain data (dates as ISO text) for the client provider. */
export function mapDoing(d: WorkspaceDoing): DoingData {
  return {
    access: d.access, done: d.done, visChoices: d.visChoices, defaultVisibility: d.defaultVisibility,
    responses: d.responses.map((r) => ({ id: r.id, stepId: r.stepId, kind: r.kind, body: r.body, visibility: r.visibility, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
  };
}

/** An ongoing session in the screens' shape. Plans and entry counts arrive later, per reader, from the server. */
function ongoingOf(s: OngoingSession): Ongoing {
  return {
    stepId: s.stepId, every: s.everyDays === 7 ? "week" : "day", everyDays: s.everyDays, start: s.start, end: s.end,
    closes: s.closes, readFirst: s.readFirst, show: s.show, plans: [],
  };
}

/** The pacing the steps' own rules add up to: all open, any dated, otherwise in order. */
function pacingOf(steps: PublishedStep[]): "open" | "in-order" | "by-date" {
  if (steps.some((s) => s.unlock?.kind === "date")) return "by-date";
  if (steps.length > 0 && steps.every((s) => s.unlock?.kind === "open")) return "open";
  return steps.length === 0 ? "open" : "in-order";
}

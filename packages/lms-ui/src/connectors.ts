import type { ComponentType } from "react";
import type { AcknowledgeResult, CreateDiscussionThread, HubWorkshop, LmsViewer, Offering, Realm } from "@elkdonis/lms";

/** A host-supplied rich-text editor. It must render a form field called `name` holding HTML. */
export type LmsEditorProps = { name: string; defaultValue: string; ariaLabel: string };

export interface LmsHostViewer extends LmsViewer {
  name: string | null;
}

export interface LmsHrefs {
  home: () => string;
  course: (courseSlug: string) => string;
  step: (courseSlug: string, stepSlug: string) => string;
  journal: () => string;
  studio: () => string;
  studioCourse: (courseSlug: string) => string;
  studioStep: (courseSlug: string, stepId: string) => string;
  studioPool: (courseSlug: string) => string;
  /** What is waiting on a guide (the journal's "To answer"), optionally for one course. */
  guide: (courseSlug?: string) => string;
  care: () => string;
  /** Sign-in, returning to `next` (a path on this host). */
  signIn: (next: string) => string;
  /** A thread on the forum. */
  forumThread: (id: string, slug: string) => string;
  /** The hub's Workshops page, and the studio page that chooses what it lists. */
  workshops: () => string;
  studioWorkshops: () => string;
  /** The Inner or Outer side of the hub. */
  side: (realm: Realm) => string;
  courses: () => string;
  guides: () => string;
  traditions: () => string;
  /** The weekly schedule; `week` is the Monday it starts on (YYYY-MM-DD). */
  schedule: (week?: string) => string;
  studioGuides: () => string;
  studioTraditions: () => string;
  studioSchedule: () => string;
}

/**
 * Everything the package needs from its host. Same idea as forum-ui: the
 * package renders and decides; the host says who is asking and where things live.
 */
export interface LmsConnectors {
  viewer: () => Promise<LmsHostViewer>;
  site: { name: string; tagline: string };
  /** Canonical origin for SEO, no trailing slash. */
  origin: string;
  hrefs: LmsHrefs;
  /** Where handleLmsAction is mounted, e.g. "/api/lms". */
  actionBase: string;
  /** Absolute URL for media stored as a path relative to another app. */
  mediaUrl: (url: string) => string;
  /** Writes a forum thread (services' createThread). Absent = no run conversations. */
  createDiscussionThread?: CreateDiscussionThread;
  /**
   * The studio's body editor (a client component). Absent = a plain textarea
   * where blank lines make paragraphs — the studio works with JavaScript off.
   */
  editor?: ComponentType<LmsEditorProps>;
  /** Find threads anywhere on the network the viewer may see (services' searchForum). For the pool. */
  searchThreads?: (q: string, viewer: LmsHostViewer) => Promise<Array<{ threadId: string; title: string; snippet: string; orgName: string; kind?: string }>>;
  /** Files already in an org's media (services' listOrgMediaLibrary). For the pool. */
  listOrgMedia?: (orgId: string) => Promise<Array<{ url: string; filename: string; kind: "audio" | "video" | "image" | "file" }>>;
  /**
   * Store an author's file in the org's media and return where it is served
   * from. The host owns validation (content sniffing, size limits) and storage.
   * Absent = the studio only takes links.
   */
  uploadMedia?: (input: { orgId: string; uploaderId: string; file: File }) => Promise<{ ok: true; url: string; kind: "audio" | "video" | "image" | "file"; name: string } | { ok: false; error: string }>;
  /**
   * A workshop's own page, where sign-up, payment and materials live — the hub
   * only links there. Absent = the workshop's forum thread.
   */
  workshopUrl?: (w: HubWorkshop) => string;
  /** Where the weekly schedule's offerings come from: one feed of one site. Absent = no schedule. */
  offerings?: { orgId: string; section: string };
  /** An offering's own page. Absent = its forum thread. */
  offeringUrl?: (o: Offering) => string;
  /** Tell a learner their guide answered. Absent = in-app only. Must never throw. */
  notifyAcknowledged?: (n: AcknowledgeResult, stepUrl: string) => Promise<void>;
}

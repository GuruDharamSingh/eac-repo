import type * as React from "react";
import type { ComposeContext } from "../compose/catalogue";
import type { ContentComposerSlots } from "../compose/ContentComposer";

// ============================================================================
// The surface vocabulary.
//
// A DESCRIPTOR says what to open; it is data, so a card can carry one, a URL
// can carry one, and a surface can hand one to the next surface it pushes.
// CONNECTORS are what the host app supplies once: how to load a thread, list a
// month, save a draft, RSVP. Every surface in this package is written against
// the connectors and nothing else — it never sees a database, a route or a
// component library — which is what lets one popup system serve apps that
// share none of those.
// ============================================================================

/** The kinds a surface knows how to present. `threads.kind`, plus the two
 *  questionnaire kinds and the three non-thread surfaces. */
export type SurfaceKind =
  | "post"
  | "event"
  | "meeting"
  | "workshop"
  | "service"
  | "product"
  | "questionnaire"
  | "poll"
  | "calendar"
  | "gallery"
  | "board"
  | "forum"
  | "compose"
  | "define"
  | "neutral";

/**
 * How much room the surface takes.
 *
 * `bare` is the odd one: no panel at all — no paper, no masthead, no foot —
 * just the surface's own content floating on the backdrop, sized to the
 * viewport's shorter axis. For a subject that is already a shape (the chart
 * wheel is a circle), a rectangle around it is furniture. A `bare` surface
 * renders its own close control, since there is no chrome to carry one.
 */
export type SurfaceSize = "compact" | "standard" | "wide" | "full" | "bare";

/**
 * What a face already knows about the thing it opens. Painted into the
 * masthead immediately, before the full record arrives, so expansion never
 * shows a blank panel with a spinner where the title should be.
 */
export interface ThreadPreview {
  title: string;
  kind?: string;
  scheduledAt?: string | null;
  coverImageUrl?: string | null;
  feedName?: string | null;
}

export type SurfaceDescriptor =
  | { type: "thread"; id: string; preview?: ThreadPreview }
  | {
      /**
       * The flip side of a profile card: the network-wide identity (the
       * ArtDirect profile), read and edited in place. With `target` it is an
       * organisation's identity instead — the same `users` row shape
       * (migration 099), edited by its owners and guides.
       */
      type: "profile";
      target?: { kind: "org"; orgId: string };
    }
  | {
      type: "compose";
      /** Omit to open the catalogue and choose. */
      kind?: string;
      /** Edit an existing thread rather than create. */
      threadId?: string;
      /** Answers to start from — a calendar day hands over its date. */
      prefill?: Record<string, unknown>;
      /** Start with the short form. Default "quick" for a prefilled open, else "full". */
      tier?: "quick" | "full";
    }
  | {
      type: "calendar";
      /** YYYY-MM. Defaults to the current month. */
      month?: string;
      /** YYYY-MM-DD to open with selected. */
      day?: string;
      /** Events the opener already has, so the first month needs no fetch. */
      events?: SurfaceEvent[];
    }
  | { type: "gallery"; title?: string }
  | {
      /** The org's Kanban (its Deck board), read and lightly edited in place. */
      type: "board";
    }
  | {
      /**
       * The org's forum at a glance: its sections, what has just been said,
       * and what this viewer has not read. Rows push a `thread` surface;
       * "Open the forum" goes to the board itself.
       */
      type: "forum";
    }
  | {
      /** One card on the board: details, due date, list, comments. */
      type: "boardCard";
      cardId: string | number;
      preview?: { title: string };
    }
  | {
      /**
       * The writing room: a post, with the finished page previewed beside the
       * words. Same `threads.kind = 'post'` row as an "Article"; a different
       * surface over it.
       */
      type: "write";
      kind?: "post";
      threadId?: string;
      prefill?: Record<string, unknown>;
    }
  | {
      /** Anything a host registers under `connectors.custom`. */
      /**
       * Define a term into the network dictionary, without leaving what you
       * are writing. Pushed as a layer, so the masthead grows a "‹ back" to
       * the article underneath and accepting returns you to your sentence.
       *
       * Carries only the term: the definition is typed here, and the wiki
       * page is created on accept. Everything is serialisable, so a
       * half-finished definition survives a reload via `?surface=`.
       */
      type: "define";
      term: string;
      /** The thread being written, recorded as a reference to the term. */
      sourceThreadId?: string;
    }
  | {
      type: "custom";
      key: string;
      title?: string;
      kind?: SurfaceKind;
      size?: SurfaceSize;
      props?: Record<string, unknown>;
    };

/**
 * A scheduled thing, as the calendar sees it. Structurally identical to
 * `OrgCalendarEvent` in @elkdonis/services so a host can pass those straight
 * through; declared here so this package does not depend on services.
 */
export interface SurfaceEvent {
  id: string;
  title: string;
  slug: string;
  kind: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
  location: string | null;
  format: string | null;
  meetingUrl: string | null;
  talkToken: string | null;
  coverImageUrl: string | null;
  recurrencePattern: string | null;
  section: string | null;
  attendeeLimit: number | null;
  rsvpCount: number;
}

export interface SurfaceSession {
  title?: string | null;
  startsAt?: string | null;
  durationMinutes?: number | null;
  location?: string | null;
}

/**
 * The full record a thread surface renders. camelCase, ISO strings for dates
 * (it crosses a JSON boundary), and every kind's fields on one type — a
 * surface reads the ones its kind has and ignores the rest.
 */
export interface SurfaceThread {
  id: string;
  title: string;
  slug: string;
  kind: string;
  status?: string;
  visibility?: string;
  feed?: { slug: string; name: string } | null;

  excerpt: string | null;
  bodyHtml: string | null;
  coverImageUrl: string | null;
  author?: { name: string | null; photo?: string | null } | null;
  publishedAt: string | null;

  // Scheduled kinds
  scheduledAt: string | null;
  /** The occurrence in play for a recurring thread; the surface shows this, not scheduledAt. */
  nextOccurrenceAt?: string | null;
  durationMinutes: number | null;
  location: string | null;
  format: string | null;
  meetingUrl: string | null;
  talkToken: string | null;
  recurrencePattern: string | null;
  recurrenceUntil?: string | null;
  /** From this app's cycle log, when it keeps one. */
  cycleStatus?: "confirmed" | "cancelled" | "pending" | null;

  // Attendance
  isRsvpEnabled: boolean;
  attendeeLimit: number | null;
  rsvpDeadline?: string | null;
  rsvpCount: number;
  /** null when the viewer is signed out or the host does not know. */
  viewerAttending?: boolean | null;

  // Priced kinds
  price?: number | string | null;
  currency?: string | null;
  sessions?: SurfaceSession[] | null;

  // Workspace
  documentUrl?: string | null;
  videoLink?: string | null;

  /** The full page, when there is one. */
  href?: string | null;

  /**
   * Host-specific fields that ride along for editing — a site's minimum
   * attendance, say. Read only by that host's own `threadToAnswers`.
   */
  extra?: Record<string, unknown>;
}

// ── Boards ──────────────────────────────────────────────────────────────────
// The Kanban vocabulary, host-neutral. amrit-canada maps Nextcloud Deck onto
// it; another org could map anything with lists and cards. The surfaces read
// only this shape.

export interface SurfaceBoardLabel {
  id: string | number;
  title: string;
  /** Hex without the #, as Deck stores it. Optional. */
  color?: string | null;
}

export interface SurfaceBoardCard {
  id: string | number;
  stackId: string | number;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  done?: boolean;
  labels?: SurfaceBoardLabel[];
  /** Display names. */
  assignees?: string[];
  commentsCount?: number;
  attachmentCount?: number;
}

export interface SurfaceBoardStack {
  id: string | number;
  title: string;
  cards: SurfaceBoardCard[];
}

export interface SurfaceBoard {
  title: string;
  stacks: SurfaceBoardStack[];
  /** The viewer may add and edit cards. */
  canWrite: boolean;
  /** The full board page, with drag-and-drop. */
  pageHref?: string | null;
}

export interface SurfaceBoardComment {
  id: string | number;
  author: string;
  message: string;
  at: string;
}

export interface SurfaceBoardConnectors {
  load: () => Promise<SurfaceBoard | null>;
  createCard?: (stackId: string | number, title: string) => Promise<SurfaceBoardCard | null>;
  updateCard?: (
    cardId: string | number,
    patch: { title?: string; description?: string; dueAt?: string | null }
  ) => Promise<boolean>;
  setDone?: (cardId: string | number, done: boolean) => Promise<boolean>;
  moveCard?: (cardId: string | number, toStackId: string | number) => Promise<boolean>;
  listComments?: (cardId: string | number) => Promise<SurfaceBoardComment[]>;
  addComment?: (cardId: string | number, message: string) => Promise<boolean>;
}

// ── Forum ───────────────────────────────────────────────────────────────────
// The forum, as one snapshot. `@elkdonis/forum-ui` renders the board itself —
// pages, pagination, the reply box — and this is the other size of the same
// object: what fits on a hub tile and in a popup.
//
// Deliberately structural, like every shape in this file: a host that stores
// its conversations somewhere else can fill this in and get the same tile.
// Counts are per viewer, because visibility is.

export interface SurfaceForumFeed {
  slug: string;
  name: string;
  /** Threads this viewer may see. */
  topicCount: number;
  /** Of those, ones with activity they have not read. Null when signed out. */
  unreadCount?: number | null;
  /** Hex; paints the row's hairline, as it does on the board. */
  accent?: string | null;
  href: string;
}

export interface SurfaceForumThread {
  id: string;
  title: string;
  /** `threads.kind` — draws the glyph. */
  kind: string;
  feedName?: string | null;
  authorName?: string | null;
  replyCount: number;
  /** ISO. */
  at: string;
  unread?: boolean | null;
  href: string;
}

export interface SurfaceForum {
  /** Names the board — "Amrit Canada" on an org site, the network otherwise. */
  title: string;
  /** The full board. The surface's primary action. */
  href: string;
  feeds: SurfaceForumFeed[];
  /** Newest first; the surface shows what fits. */
  recent: SurfaceForumThread[];
  topicCount: number;
  postCount: number;
  /** Threads with unread activity. Null when signed out. */
  unreadCount?: number | null;
  /** Where "Unread" goes, when there is somewhere. */
  unreadHref?: string | null;
  /** Enables the "Start a topic" action. */
  composeHref?: string | null;
}

export interface SurfaceForumConnectors {
  load: () => Promise<SurfaceForum | null>;
  /** Omit to hide the control. Returns false if it did not take. */
  markAllRead?: () => Promise<boolean>;
}

export interface SurfaceAction {
  label: string;
  onClick?: () => void | Promise<void>;
  href?: string;
  external?: boolean;
  /** Filled, in the kind's accent. One per bar. */
  primary?: boolean;
  quiet?: boolean;
  danger?: boolean;
  /** The "you already did this" state — RSVP'd, registered. */
  done?: boolean;
  disabled?: boolean;
  /** Download hint for `href` — an .ics file, say. */
  download?: string;
}

// ── The profile surface ───────────────────────────────────────────────────

export interface SurfaceProfileLink {
  label: string | null;
  url: string;
}

/** A `users` row as the surface sees it — a person, or an org's identity. */
export interface SurfaceProfile {
  kind: "person" | "organization";
  displayName: string;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  pronouns: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  socialLinks: SurfaceProfileLink[];
  slug: string | null;
  /** The public page, when there is one. */
  pageHref: string | null;
  /** Whether the viewer may save changes. */
  canEdit: boolean;
  /** Doors out of the surface: the person's files, blog, store. */
  hrefs?: { files?: string | null; blog?: string | null; store?: string | null };
}

export interface SurfaceProfileInput {
  displayName?: string;
  headline?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  pronouns?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  socialLinks?: SurfaceProfileLink[];
}

export type SaveProfileResult = { ok: true } | { ok: false; error: string };

export type SurfaceProfileTarget = { kind: "org"; orgId: string } | undefined;

export interface SurfaceProfileConnectors {
  load: (target: SurfaceProfileTarget) => Promise<SurfaceProfile | null>;
  save: (target: SurfaceProfileTarget, input: SurfaceProfileInput) => Promise<SaveProfileResult>;
  /** Omit to hide the avatar control. Resolves to the stored URL. */
  uploadAvatar?: (file: File) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
}

export type SaveThreadResult =
  | { ok: true; id: string; href?: string | null }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export type RsvpResult =
  | { ok: true; attending: boolean; count?: number }
  | { ok: false; error: string };

export interface SurfaceViewer {
  signedIn: boolean;
  /** For the byline in the writing room's preview. */
  displayName?: string | null;
  /** Can open the compose surface at all. */
  canCompose: boolean;
  /** Can edit this particular thread. Defaults to canCompose. */
  canEdit?: (thread: SurfaceThread) => boolean;
}

export interface SurfaceConnectors {
  viewer: SurfaceViewer;
  /** Shown in kickers ("Calendar · Amrit Canada"). */
  orgName?: string;
  /** The profile surface. Omit and profile faces simply navigate. */
  profile?: SurfaceProfileConnectors;

  /** A thread by id, as this viewer may see it. Null when not found. */
  loadThread: (id: string) => Promise<SurfaceThread | null>;

  /** Scheduled threads in [from, to). Omit to disable the calendar surface. */
  listEvents?: (from: Date, to: Date) => Promise<SurfaceEvent[]>;

  /** The org's image library. Omit to disable the gallery surface. */
  listMedia?: () => Promise<Array<{ url: string; name: string }>>;
  /** POST target taking multipart `file`, returning `{ url }`. Enables upload in the gallery. */
  uploadEndpoint?: string;
  uploadFields?: Record<string, string>;

  /** Member RSVP. Omit to hide the RSVP control. */
  rsvp?: (thread: SurfaceThread, going: boolean) => Promise<RsvpResult>;

  /** Save from the compose surface. Omit to make compose read-only (catalogue links only). */
  saveThread?: (input: {
    kind: string;
    answers: Record<string, unknown>;
    status: "draft" | "published";
    threadId?: string;
  }) => Promise<SaveThreadResult>;

  /** What this org can compose. Read by the picker and the field builder. */
  compose?: ComposeContext;
  /** The host's rich-text editor and media picker, for the compose surface. */
  composeSlots?: ContentComposerSlots;
  /**
   * Turn a loaded thread into compose answers, for editing. The default maps
   * the shared columns; supply this when the host stores extra fields.
   */
  threadToAnswers?: (thread: SurfaceThread) => Record<string, unknown>;

  /** Extra actions for a thread surface — "Register", "Confirm this month". */
  threadActions?: (thread: SurfaceThread, helpers: { refresh: () => void }) => SurfaceAction[];

  /** The org's board. Omit to disable the board surfaces. */
  board?: SurfaceBoardConnectors;

  /** The org's forum. Omit to disable the forum surface. */
  forum?: SurfaceForumConnectors;

  /**
   * The network dictionary, behind the define surface. Omit and the "Define"
   * affordance stays hidden rather than failing when used.
   *
   * A term may hold several senses: defining one that already exists appends
   * your wording rather than overwriting theirs or refusing you. `lookup`
   * reports what is already there so the surface can say so before you write.
   */
  dictionary?: {
    lookup: (
      term: string
    ) => Promise<{ slug: string; title: string; senses: number } | null>;
    define: (input: {
      term: string;
      definition: string;
      sourceThreadId?: string;
    }) => Promise<{ slug: string; created: boolean; senses: number; duplicate: boolean }>;
  };

  /** Nextcloud's public origin, for Talk join links. */
  talkBaseUrl?: string | null;

  /** Render times in this zone. Defaults to the viewer's. */
  timeZone?: string;
  locale?: string;
  /** The reading layer's voice for previews — matches what the published page uses. */
  readingVoice?: "journal" | "gazette" | "quiet";

  /** Host-registered surfaces, by key. */
  custom?: Record<
    string,
    (props: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) => React.ReactNode
  >;

  /** Called after something changed on the server — a host calls router.refresh(). */
  onMutated?: () => void;
}

/** Whether a kind happens at a time. Mirrors SCHEDULED_KINDS in services. */
export const SCHEDULED_KINDS: ReadonlySet<string> = new Set(["event", "meeting", "workshop"]);
/** Whether a kind has a price. Which kinds are *purchasable* is commerce's call. */
export const PRICED_KINDS: ReadonlySet<string> = new Set(["workshop", "service", "product"]);

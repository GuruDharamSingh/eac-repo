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
  | "document"
  | "idea"
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
      /**
       * Which half opens first. "details" is the read view — the portrait, the
       * statement, what is waiting for you; "edit" goes straight to the fields.
       * The face offers both, so a member who only wanted to check their
       * messages never lands in a form. Defaults to "details".
       */
      mode?: "details" | "edit";
      /**
       * Which tab of a person's own profile opens first. Deep-linkable
       * (`?surface=profile:details`); tabs the host cannot fill are hidden and
       * a link to one lands on Profile. Ignored for an org `target`.
       */
      tab?: SurfaceProfileTab;
    }
  | {
      /** Arrange an org's center: which sections, in what order, with which knobs. */
      type: "centerLayout";
      orgId: string;
    }
  | {
      /**
       * The names this person writes under — their own, plus any pen names,
       * plus the organisations whose byline they may use.
       *
       * One surface for all three because they are one mechanism: an identity
       * is a `users` row, and an org's own row (migration 099) differs from a
       * pen name (migration 132) only in what it is allowed to hold.
       */
      type: "identities";
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
      /**
       * Sign it with one of the viewer's other identities. The id is a CLAIM,
       * never a permission: the host re-checks it through `resolveActor` on
       * the way in, so a forged value fails at the write, not at the form.
       */
      actingAs?: string | null;
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
  | {
      /**
       * The org's images. `images` seeds the grid from what the face already
       * drew, so opening a gallery whose thumbnails you were just skipping
       * through shows those same images at once rather than a spinner; the
       * surface still refreshes from `listMedia` behind them.
       */
      type: "gallery";
      title?: string;
      images?: SurfaceImage[];
      /** Open with this one already in the lightbox — the face's current thumbnail. */
      startAt?: number;
    }
  | {
      /** The org's Kanban (its Deck board), read and lightly edited in place. */
      type: "board";
    }
  | {
      /**
       * Arrange what a thread HOLDS: attach the document written at this
       * meeting, the board slice it moved, the discussion it started; detach
       * what no longer belongs; put it in the order it should read in.
       *
       * A pushed layer over the thread rather than a field inside compose,
       * because gathering happens AFTER the fact — you attach last week's
       * minutes to last week's meeting — and compose is for the thread's own
       * columns. Editors only; the band it arranges is for everyone.
       */
      type: "gather";
      threadId: string;
      /** The host thread's title, for the masthead before anything loads. */
      title?: string;
    }
  | {
      /**
       * The group's living documents: real files in the org's Nextcloud
       * folder, collaboratively editable by link. The surface lists them,
       * starts new ones, and assigns one to an idea it belongs to.
       */
      type: "documents";
      /** What the face already listed, so the panel opens populated. */
      documents?: SurfaceDocument[];
      /** Open with the "start one" field focused and pre-filled. */
      draftTitle?: string;
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
      /**
       * One SECTION of the forum — its threads, in the popup.
       *
       * A pushed layer rather than state inside the forum surface, because
       * the masthead's "‹ back" comes from the layer stack: walking into a
       * section should be dismissed the same way as walking into a thread,
       * with the same control in the same place, not with a second bespoke
       * back link inside the panel.
       */
      type: "forumFeed";
      slug: string;
      name: string;
      /** The section on the board itself, for "open the full list". */
      href: string;
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
      /**
       * Post from /center to any org the person is part of, or their own
       * blog (Brief A slice 3). `target` preselects a destination
       * (`orgId|feedSlug` or `blog`); the list itself comes from
       * `connectors.postTo`, and the server re-checks the choice.
       */
      type: "postTo";
      target?: string;
      /** A title already typed (the hub's one-line compose). Not in the URL. */
      title?: string;
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
      /**
       * ONE file, looked at where you are.
       *
       * The gallery surface is the org's whole library and refetches it on
       * open; a material is a single thing already named by whatever pushed
       * it — a document handed out at last week's meeting, the recording of
       * it — and the point is that opening it does not throw the page away.
       * Images, video and audio play here; anything else gets its link, in a
       * panel, rather than a navigation.
       */
      type: "material";
      material: SurfaceMaterial;
      /** Named above the title: "Last meeting", "Workshop materials". */
      context?: string | null;
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
 * One file attached to something — a handout, a recording, a photo of the
 * whiteboard. Structurally the `MeetingMaterial` of @elkdonis/services, so a
 * host passes those straight through.
 */
export interface SurfaceMaterial {
  id: string;
  name: string;
  /** A platform URL (`/api/media/…`) or, for `external`, somewhere else. */
  url: string;
  kind: "image" | "video" | "audio" | "document";
  mimeType?: string | null;
  size?: number | null;
  /** The URL leaves the network, so the surface offers it rather than embeds it. */
  external?: boolean;
}

/** One image in an org's library, as every media surface reads it. */
export interface SurfaceImage {
  url: string;
  name: string;
}

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
// ── What a thread holds ─────────────────────────────────────────────────────
// A group's week is a meeting, the document written in it, the terms defined
// out of that document, the discussion that followed and a couple of board
// cards. `thread_gathers` (migration 131) is the edge that makes those one
// occasion; these are the shapes the surface renders it in.
//
// Structural, like everything else in this file: a host that keeps its
// occasions somewhere else fills these in and gets the same bands.

export type SurfaceGatherRelation = "gathers" | "produced" | "talk" | "cites";

export interface SurfaceGathered {
  /** The EDGE's id, not the target's — what a detach call takes. */
  id: string;
  relation: SurfaceGatherRelation;
  targetType: "thread" | "document" | "deck_card" | "deck_label" | "file" | "quote" | "link";
  title: string;
  subtitle: string | null;
  /**
   * Null is a legitimate answer and this band renders it as a row that does
   * not open. A living document's URL is withheld from non-members — the
   * share is public and WRITABLE — but the row still lists, because knowing
   * the group wrote minutes is not the same as being able to edit them.
   */
  href: string | null;
  /** Leaves the app: Nextcloud, Deck, an arbitrary link. */
  external: boolean;
  /** Set only for thread targets; lets the popup push a layer instead of navigating. */
  threadId?: string | null;
  kind?: string | null;
}

/** The reverse edge: an occasion this thread was gathered onto. */
export interface SurfaceGatheredBy {
  id: string;
  slug: string;
  title: string;
  kind: string;
  relation: SurfaceGatherRelation;
  href?: string | null;
}

/** A term defined out of this thread. Derived from the prose, not curated. */
export interface SurfaceTerm {
  id: string;
  slug: string;
  title: string;
  /**
   * Where this host keeps its wiki. Supplied by the host, never assembled
   * here — the wiki is network-wide but its path is not the same on every
   * site, and this package does not know routes. Absent renders as a plain
   * chip, which is still worth showing: the vocabulary is the point.
   */
  href?: string | null;
}

/**
 * Something that could be attached, as offered by the host's search.
 *
 * Deliberately the same field names the attach call takes, so the surface
 * hands a candidate straight back without reshaping it — the host decides
 * what is attachable (its threads, its documents, its board) and the surface
 * only ever lists and forwards.
 */
export interface SurfaceGatherCandidate {
  targetType: SurfaceGathered["targetType"];
  targetThreadId?: string | null;
  targetRef?: string | null;
  title: string;
  subtitle?: string | null;
}

export interface SurfaceGatherConnectors {
  /** Everything currently attached, in order. */
  list: (threadId: string) => Promise<SurfaceGathered[]>;
  /** What could be attached. `q` empty means "offer the obvious things". */
  candidates: (threadId: string, q: string) => Promise<SurfaceGatherCandidate[]>;
  attach: (
    threadId: string,
    candidate: SurfaceGatherCandidate & { relation?: SurfaceGatherRelation }
  ) => Promise<boolean>;
  /** Takes the EDGE id. The target itself is never touched. */
  detach: (threadId: string, edgeId: string) => Promise<boolean>;
  /** Persist an arrangement. Omit and the surface hides the reordering arrows. */
  reorder?: (threadId: string, edgeIds: string[]) => Promise<boolean>;
}

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
  /** The account that wrote it — what `viewer.canRemove` compares against. */
  authorId?: string | null;
  /** True when this is the org's featured (standing) meeting. */
  standing?: boolean;
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

  // What this thread HOLDS. All three are optional: a host that has not wired
  // gathering renders exactly the thread it always did.
  /** Curated attachments, in the order someone arranged them. */
  gathered?: SurfaceGathered[];
  /** Occasions that gathered THIS thread — the provenance line. */
  gatheredBy?: SurfaceGatheredBy[];
  /** Terms defined out of this thread. */
  terms?: SurfaceTerm[];

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
  /**
   * The threads in one section, newest first.
   *
   * Optional, and the reason it is optional is worth stating: without it a
   * section row still opens IN the popup, filtered out of the `recent` list
   * the surface already holds. That is honest for a small board and wrong
   * for a big one — `recent` is the latest N across every section, so a
   * quiet section looks empty rather than old. A host that can answer
   * properly supplies this and the popup shows the real list.
   */
  listFeed?: (slug: string) => Promise<SurfaceForumThread[]>;
}

// ── Living documents ────────────────────────────────────────────────────────
// A document here is a real file in the org's Nextcloud folder, shared by a
// writable link — which is what makes it editable by the majority of members,
// who have no Nextcloud account of their own. The surface never sees WebDAV;
// it sees this shape and the three functions under it.
//
// Deliberately NOT `threads.nextcloud_doc_url` (thread-document.ts): that path
// puts a draft in its AUTHOR'S folder with no share, which is right for a post
// someone is writing alone and wrong for the group's notes.

// ── Identities ──────────────────────────────────────────────────────────────
// One account, several names. `self` is the person's own row and is always
// present; `pseudonym` is a name they hold privately; `organization` is a body
// whose byline their role lets them use.
//
// Note what is NOT here: nothing maps a pseudonym back to the account that
// holds it. The face lists what YOU may write as — it is never a lookup in the
// other direction, and no response this surface reads carries one.

export interface SurfaceIdentity {
  id: string;
  relation: "self" | "pseudonym" | "organization";
  displayName: string;
  slug?: string | null;
  avatarUrl?: string | null;
  /** Private note the holder wrote for themself. Pseudonyms only. */
  label?: string | null;
  /** ISO. Set means the name is kept but no longer written under. */
  retiredAt?: string | null;
  /** Organisation identities only. */
  orgId?: string | null;
}

export interface SurfaceIdentityConnectors {
  list: () => Promise<SurfaceIdentity[]>;
  /** Open another name. Omit and the surface reads without offering one. */
  create?: (input: {
    displayName: string;
    slug?: string;
    label?: string;
  }) => Promise<{ ok: true; identity: SurfaceIdentity } | { ok: false; error: string }>;
  /**
   * Stop writing under a name, or start again. Retiring never deletes: what
   * the name wrote keeps its byline. Omit and no retire control is drawn.
   */
  setRetired?: (
    identityId: string,
    retired: boolean
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** How many pen names this account may hold at once. Default 2. */
  maxPseudonyms?: number;
}

export interface SurfaceDocument {
  id: string;
  title: string;
  /** Where a member opens it. A public writable share, so no account is needed. */
  editUrl: string;
  createdAt: string;
  /** Display name, when the host records one. */
  createdBy?: string | null;
  /**
   * The first lines of the file. What makes the face a *snapshot* rather than
   * a filename — a host that cannot cheaply read the body omits it and the
   * face falls back to the title.
   */
  snippet?: string | null;
  /** ISO; when the file itself last changed, not when the row was written. */
  updatedAt?: string | null;
  /**
   * The idea this document belongs to, when it has been assigned to one.
   * A scrap doc starts unassigned, which is the point of a scrap doc.
   */
  ideaId?: string | null;
  ideaTitle?: string | null;
}

export interface SurfaceDocumentConnectors {
  list: () => Promise<SurfaceDocument[]>;
  /**
   * Start one. Omitting `title` asks for a SCRAP doc: the host names it by
   * date and the member starts typing rather than naming a thing they have
   * not written yet.
   */
  create: (input: {
    title?: string;
    ideaId?: string;
  }) => Promise<{ ok: true; document: SurfaceDocument } | { ok: false; error: string }>;
  /** Assign an existing document to an idea, or pass null to unassign. */
  assign?: (
    documentId: string,
    ideaId: string | null
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /**
   * Take a document off the group's list. Omit and no remove control is drawn.
   *
   * Whether the underlying FILE goes with it is the host's call, and the
   * surface says which: the shared implementation keeps it in the org's
   * Nextcloud folder, so this is "off the list", not "destroyed".
   */
  remove?: (
    documentId: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}

// ── Suggested ideas ─────────────────────────────────────────────────────────
// An idea is a thread (`kind = 'idea'`) in the org's ideas feed, so proposing
// one and discussing it happen in the same place the rest of the org's
// conversation does. The face IS the form; `href` is where the conversation
// lives, and is the only thing "opening" the tile does.

export interface SurfaceIdea {
  id: string;
  title: string;
  authorName?: string | null;
  createdAt: string;
  replyCount?: number;
  /** The idea's own thread on the board. */
  href?: string | null;
}

export interface SurfaceIdeaConnectors {
  /** The ideas feed on the forum. The face's only navigation target. */
  href: string;
  list?: () => Promise<SurfaceIdea[]>;
  create: (input: {
    title: string;
  }) => Promise<{ ok: true; idea: SurfaceIdea } | { ok: false; error: string }>;
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
  /**
   * What is waiting for this person. Shown as counts on the face and in the
   * surface's facts. A count with no inbox to open is still worth stating —
   * a number that is true beats a button that goes nowhere — so nothing here
   * is a link.
   */
  alerts?: {
    unreadMessages?: number;
    notifications?: number;
    /** Things they have said they are coming to. */
    upcoming?: number;
  };
  /** The Details tab's fields. Own profile only; absent means no tab. */
  details?: SurfaceProfileDetails;
}

/** The tabs of a person's own profile popup. "profile" is the card itself. */
export type SurfaceProfileTab = "profile" | "details" | "show" | "page" | "payouts";

/**
 * What the Details tab edits beyond the card: the rest of a person's own
 * `users` row. Present only on the viewer's OWN profile, and only when the
 * host serves it — omit it and there is no Details tab.
 */
export interface SurfaceProfileDetails {
  postalCode: string | null;
  portfolioUrl: string | null;
  /** `#rrggbb`: the colour of their name on replies. */
  commentColor: string | null;
  /** Where the slug shows, e.g. "https://artdirect.example/" — for the preview. */
  pageBase?: string | null;
  /** Read-only facts about the account, shown at the foot of Details. */
  account?: {
    email: string | null;
    /** ISO date the account was made. */
    createdAt: string | null;
    /** Their Nextcloud, once they have signed in there. */
    cloud?: { url: string; username: string } | null;
    /** POSTed to sign out; the surface then goes to `signOutTo`. Omit to hide. */
    signOutEndpoint?: string | null;
    signOutTo?: string | null;
  };
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
  // Details tab (own profile only; the route ignores them for an org).
  postalCode?: string | null;
  portfolioUrl?: string | null;
  commentColor?: string | null;
  /** Changes the person's URL. Never null. */
  slug?: string;
}

export type SaveProfileResult = { ok: true } | { ok: false; error: string };

export type SurfaceProfileTarget = { kind: "org"; orgId: string } | undefined;

export interface SurfaceProfileConnectors {
  load: (target: SurfaceProfileTarget) => Promise<SurfaceProfile | null>;
  save: (target: SurfaceProfileTarget, input: SurfaceProfileInput) => Promise<SaveProfileResult>;
  /** Omit to hide the avatar control. Resolves to the stored URL. */
  uploadAvatar?: (file: File) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  /**
   * What the person's own page carries, and whether they can be paid.
   *
   * Optional, and only ever offered on a viewer's OWN profile — an org
   * identity has no writing shelf and no payouts. Omit it and the surface is
   * exactly the card it has always been, which is why amrit-canada and
   * artdirect are untouched by this.
   */
  page?: SurfaceProfilePageConnectors;
  /** "Where you show" — own profile only. Omit and there is no such tab. */
  presence?: SurfacePresenceConnectors;
}

// ── Where you show (Brief A slice 2) ─────────────────────────────────────
// Structurally the same as @elkdonis/services' Presence; cms-ui has no
// services dependency, so it declares its own.

export interface SurfacePresenceColumn {
  /** 'directory' | 'page' | 'market' | `org:<orgId>` */
  key: string;
  label: string;
  kind: "directory" | "page" | "org" | "market";
  orgId?: string;
  /** Where that place is, when the host knows. */
  href?: string | null;
}

export type SurfacePresenceCell =
  | { state: "switch"; on: boolean; note?: string | null }
  | { state: "request"; pending: boolean; note?: string | null }
  | { state: "status"; label: string; note?: string | null };

export interface SurfacePresenceRow {
  key: "you" | "blog" | "store" | "galleries";
  label: string;
  cells: Record<string, SurfacePresenceCell>;
}

export interface SurfacePresence {
  columns: SurfacePresenceColumn[];
  rows: SurfacePresenceRow[];
}

export interface SurfacePresenceConnectors {
  load: () => Promise<SurfacePresence>;
  set: (change: {
    row: SurfacePresenceRow["key"];
    column: string;
    on: boolean;
  }) => Promise<{ ok: true; pending?: boolean } | { ok: false; error: string }>;
}

/** One optional section on a person's own page. */
export interface SurfaceProfileSection {
  key: string;
  label: string;
  /** One line saying what turning it on does. */
  blurb?: string;
  on: boolean;
  /**
   * Set when the section cannot be turned on yet and why — "you have no store
   * on the network". Rendered instead of the switch, because a control that
   * silently refuses is worse than one that explains.
   */
  blockedReason?: string | null;
  /** Where the section shows once it is on. */
  href?: string | null;
}

/**
 * Being payable.
 *
 * Only ever about a PERSON: the money model settled 2026-09-05 makes the
 * maker the payee, and an org's share is a ledger balance inside the host
 * account rather than a connected account of its own.
 */
/** One line of a person's ledger — a sale that paid them, or a payout that settled it. */
export interface SurfaceProfilePayoutLine {
  id: string;
  /** What moved, in a phrase — an order number, a payout method, whatever the host resolved. */
  label: string;
  amountMinor: number;
  at: string;
  /** Accrued but not yet payable (still held). */
  held: boolean;
}

export interface SurfaceProfilePayouts {
  /** Stripe Express: none | started but not payable | payable. */
  state: "none" | "pending" | "ready";
  /** Shown when `ready`, so a person can see which account they connected. */
  accountLabel?: string | null;
  /** Absent when the platform has no Stripe keys — the control then says so. */
  available: boolean;
  /**
   * ISO-3166 alpha-2, when the host already knows it. Stripe fixes a
   * connected account's country at creation and never changes it after, so
   * this must be asked BEFORE the account exists — null here (with
   * `state: "none"`) is what tells the surface to ask rather than assume the
   * platform's own country (see the 2026-09-20 CA-default bug).
   */
  country?: string | null;
  /**
   * What has actually moved for this person — omitted where the host has no
   * ledger to read. cms-ui declares its own shape here rather than depending
   * on @elkdonis/commerce (see SurfacePresence above for the same reasoning),
   * so a host with no commerce package still type-checks against this.
   */
  work?: {
    currency: string;
    payableMinor: number;
    heldMinor: number;
    totalMinor: number;
    lines: SurfaceProfilePayoutLine[];
  } | null;
  /**
   * A host-authored explanation, collapsed under its own summary — e.g. why
   * sales here route through Stripe, or what the fees are. Per-host copy, so
   * it lives in data the connector supplies, not in this shared component.
   */
  onboarding?: { title: string; paragraphs: string[] } | null;
}

export interface SurfaceProfilePageConnectors {
  load: () => Promise<{
    sections: SurfaceProfileSection[];
    payouts?: SurfaceProfilePayouts | null;
  }>;
  setSection: (
    key: string,
    on: boolean
  ) => Promise<{ ok: true; href?: string | null } | { ok: false; error: string }>;
  /**
   * Begin (or resume) Stripe Express onboarding, returning the URL to send
   * the person to. Omit when this host does not handle money.
   *
   * `country` (ISO-3166 alpha-2) is required the FIRST time — before any
   * account exists — because that is the only moment it can still be set;
   * the surface collects it and passes it through. Once an account already
   * exists (resuming onboarding), the host doesn't need it again.
   */
  startPayouts?: (country?: string) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  /**
   * Disconnect a connected account and start over — the only way out of one
   * created with the wrong country (Stripe never lets it change). Omit to
   * hide the control; hosts that predate this stay exactly as they were.
   */
  disconnectPayouts?: () => Promise<{ ok: true } | { ok: false; error: string }>;
}

// ── Arranging a center ────────────────────────────────────────────────────

export interface SurfaceCenterLayoutShape {
  columns: { left: string[]; right: string[] };
  hidden: string[];
  options: {
    feed?: { limit?: number };
    network?: { limit?: number };
    pinned?: { limit?: number };
    site?: { ratio?: "5:3" | "4:3" };
  };
  voice: "journal" | "gazette" | "quiet";
  /** Optional so a host that predates the desk still type-checks. */
  arrangement?: "columns" | "desk";
}

export interface SurfaceCenterLayout {
  orgId: string;
  orgName: string;
  /** What the page currently shows: default ← network ← org. */
  resolved: SurfaceCenterLayoutShape;
  /** Every section the page knows, for the pick lists. */
  sections: Array<{ id: string; label: string }>;
  canEdit: boolean;
  /** Set when the viewer may also edit the network default; the org id that holds it. */
  networkOrgId?: string | null;
}

export interface SurfaceCenterLayoutConnectors {
  load: (orgId: string) => Promise<SurfaceCenterLayout | null>;
  save: (orgId: string, layout: SurfaceCenterLayoutShape) => Promise<SaveProfileResult>;
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
  /**
   * Can take this thread down. Defaults to canEdit. A host usually answers
   * "editor, or this is the viewer's own" — `thread.authorId` is there for it.
   */
  canRemove?: (thread: SurfaceThread) => boolean;
}

export interface SurfaceConnectors {
  viewer: SurfaceViewer;
  /** Shown in kickers ("Calendar · Amrit Canada"). */
  orgName?: string;
  /** The profile surface. Omit and profile faces simply navigate. */
  profile?: SurfaceProfileConnectors;
  /** "Post to…" from /center — every place the viewer may post. Omit to hide. */
  postTo?: SurfacePostToConnectors;
  /** Arranging a center's definition (owners, guides; admins for the network default). */
  centerLayout?: SurfaceCenterLayoutConnectors;

  /** A thread by id, as this viewer may see it. Null when not found. */
  loadThread: (id: string) => Promise<SurfaceThread | null>;
  /**
   * Take a thread down (archive). Rendered as "Remove" on the popup for
   * whoever `viewer.canRemove` allows; the rule itself is the host's route.
   */
  removeThread?: (threadId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /**
   * Name a meeting the org's standing (weekly) meeting, or stop featuring
   * it — the flag the hub's standing-meeting card reads first. Editors only.
   */
  standing?: {
    set: (threadId: string, on: boolean) => Promise<{ ok: true; standing: boolean } | { ok: false; error: string }>;
  };

  /** Scheduled threads in [from, to). Omit to disable the calendar surface. */
  listEvents?: (from: Date, to: Date) => Promise<SurfaceEvent[]>;

  /** The org's image library. Omit to disable the gallery surface. */
  listMedia?: () => Promise<SurfaceImage[]>;
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
    /**
     * Sign it as one of the viewer's other identities. A CLAIM, not a
     * permission: the host passes it through `resolveActor` server-side, so a
     * forged id is refused at the write. Omitted or null means the viewer's
     * own name.
     */
    actingAs?: string | null;
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

  /** The names this viewer writes under. Omit and the identities face hides. */
  identities?: SurfaceIdentityConnectors;

  /** The group's living documents. Omit to disable the documents surface. */
  documents?: SurfaceDocumentConnectors;

  /** Suggested ideas. Omit and the ideas face stays hidden. */
  ideas?: SurfaceIdeaConnectors;

  /**
   * What a thread holds (migration 131). Omit and threads still RENDER their
   * gathered band — that comes down with the thread itself — but there is no
   * way to change it from the popup.
   */
  gather?: SurfaceGatherConnectors;

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
export const SCHEDULED_KINDS: ReadonlySet<string> = new Set(["event", "meeting", "workshop", "reading_group"]);
/** Whether a kind has a price. Which kinds are *purchasable* is commerce's call. */
export const PRICED_KINDS: ReadonlySet<string> = new Set(["workshop", "service", "product"]);

// ── Post to… (Brief A slice 3) ──────────────────────────────────────────────

export interface SurfacePostTarget {
  /** `orgId|feedSlug`, or `blog`. */
  value: string;
  kind: "feed" | "blog";
  orgId: string | null;
  orgName: string;
  feedSlug: string | null;
  feedName: string;
}

export interface SurfacePostToConnectors {
  targets: () => Promise<SurfacePostTarget[]>;
  create: (input: {
    target: string;
    title: string;
    text: string;
  }) => Promise<{ ok: true; href: string | null; label: string } | { ok: false; error: string }>;
}

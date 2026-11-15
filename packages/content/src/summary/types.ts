// ============================================================================
// The piece summary (canvas C, "Studio pipeline frame", 2026-11-14): one piece
// drawn as its cover and facts, where it went and what is next. One component
// in three places: a page in the Studio, an in-flow sheet, and (2026-11-15,
// the developer's direction for the site Channel) the "manage piece" pop-up
// any piece opens in: from the right on a desktop, from the bottom on a phone,
// with Edit inline (the site's quick form), Make into and Open in Studio.
// Plain data in; the host decides where it comes from.
// ============================================================================

import type * as React from 'react';
import type { ContentMark } from '../model';

export interface PieceSummaryOut {
  id: string;
  /** The outlet or place: "Instagram", "Site and calendar". */
  label: string;
  /** "41 likes", "22 opened". */
  sub: string | null;
  /** ISO. */
  at: string | null;
  /**
   * published (drawn "out") | live | failed — under Out; scheduled | planned | draft — under Planned;
   * suggested | info as given.
   */
  state: string;
  href: string | null;
}

export interface PieceSummaryNext {
  id: string;
  title: string;
  reason: string | null;
  /** The button: "Plan it", "Open", "Record". */
  label: string;
  href: string | null;
}

/** A "Next for this piece" row whose buttons the host draws (a site's Accept / Plan it / ✕). */
export interface PieceSummaryNextRow {
  id: string;
  title: string;
  reason?: string | null;
  actions?: React.ReactNode;
}

/** A step of the piece's plan (plan.md), with the host's control (a site: a checkbox through its door). */
export interface PieceSummaryPlanStep {
  id: string;
  label: string;
  done: boolean;
  /** ISO, when the step is due. */
  due?: string | null;
  /** The host's tick control; without one the step's state is drawn read-only. */
  control?: React.ReactNode;
}

/**
 * The piece's plan (2026-11-15, docs/open/channel-convergence-2026-11-15): the plan.md that "Plan it" starts on
 * arts-collective's Channel, drawn in the summary so a site's pop-up, the hub card and Studio show the same plan.
 * The host draws the buttons (Start the plan, Propose steps), as with `nextRows`.
 */
export interface PieceSummaryPlan {
  /** none: no plan.md yet; started: one exists (it may have no steps). */
  state: 'none' | 'started';
  /** The plan's goal line. */
  goal?: string | null;
  steps: PieceSummaryPlanStep[];
  /** Start the plan / Propose steps / Open the plan ↗. */
  actions?: React.ReactNode;
}

export interface PieceSummaryView {
  /** `<store>:<id>`, the Make into route's `from`. */
  key: string;
  /** A content type id ("meeting", "artwork"), for Make into's targets. */
  type: string;
  /** "Meeting", "Artwork". */
  typeLabel: string;
  /** "Katie the Potter · credited to Noa". */
  byline: string | null;
  title: string;
  excerpt: string | null;
  /** The library's detail line, drawn when no labelled facts are given. */
  meta: string | null;
  /** Up to three pictures; the first is the cover. */
  pictures: string[];
  /** All the piece's pictures, for the cover's tag. */
  pictureCount: number;
  /** Labelled facts ("When", "Where", "Coming", "Price"), at most four drawn. */
  facts: Array<{ label: string; value: string }>;
  /** "published", "draft"…, with the first publish date when there is one. */
  status: { label: string; at: string | null };
  /** Where it went and where it is planned to go, any order; drawn as Planned (soonest first), then Out (newest first). */
  out: PieceSummaryOut[];
  /** Next for this piece: the action registry's list, as the dock and the Queue draw it. */
  next: PieceSummaryNext[];
  /** Coverage per outlet, as the content library's row and lightbox draw it. */
  marks?: ContentMark[];
  links: {
    /** The piece where people see it. */
    view: string | null;
    /** The piece in Channel (its board). */
    channel: string | null;
    /** Plan it: the piece's plan in Channel. Leave null where planning happens in the pop-up's own rows. */
    plan: string | null;
  };
}

export interface PieceSummaryProps {
  view: PieceSummaryView;
  /**
   * "page" in the Studio; "sheet" an in-flow side panel; "popup" the manage-piece pop-up (fixed: from the
   * right at 640px and up, a bottom sheet below, over a scrim that closes it).
   */
  layout?: 'page' | 'sheet' | 'popup';
  /** Edit: a handler, or a link (a site: `?piece=<key>&edit=1`; a kind with no quick form: its Studio link). */
  onEdit?: () => void;
  editHref?: string | null;
  /** The site's quick form, drawn in place of the facts and lists while `editing`. */
  edit?: React.ReactNode;
  editing?: boolean;
  /** "← Back to the piece" above the form while editing (the form's own Done should go there too). */
  closeEditHref?: string | null;
  /** Make into ▾ entries, links to the Make into route. Empty hides it. */
  makeInto?: Array<{ to: string; label: string; href: string }>;
  /** "Open in Studio ↗", the full form. */
  studioHref?: string | null;
  /** "Open in Katie the Potter’s Channel". */
  channelLabel?: string;
  /** Sheet and pop-up: a handler, or a link for a server-drawn one (`?piece=` off). */
  onClose?: () => void;
  closeHref?: string | null;
  /** "Next for this piece" with the host's buttons; replaces `view.next` when given. */
  nextRows?: PieceSummaryNextRow[];
  /** The piece's plan, drawn first among the lists; unset hides the Plan box. */
  plan?: PieceSummaryPlan;
  /** Buttons for a row of "Where it went", by its id (a planned row's Unplan). */
  outActions?: Record<string, React.ReactNode>;
  /** The whole action row, drawn instead of the default one when given. */
  actions?: React.ReactNode;
  /** Drawn after the two lists (a site's own notes). */
  children?: React.ReactNode;
  /** The channel's time zone for dates; unset, the browser's (fine for a page drawn only in the browser). */
  timeZone?: string;
}

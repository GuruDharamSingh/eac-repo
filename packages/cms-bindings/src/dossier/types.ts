/**
 * Canonical data contract for the artist dossier template
 * (connector template: dossier-classified).
 *
 * Hydrated from `users` + `org_profiles` + `threads` + `user_galleries` +
 * `store` by any consumer (ArtDirect, IFAC, a future org site) before
 * rendering. The v0.1 contract only described identity, because the template
 * only had identity to describe; the additions below are the person's real
 * published work, which existed in the database the whole time and had
 * nowhere on their own profile to appear.
 */

export type DossierOperation = {
  title: string;
  date?: string | null;
  details?: string | null;
  image_url?: string | null;
};

export type DossierChannel = {
  title: string;
  description?: string | null;
  url: string;
};

/** One line of the service record — where they showed, taught or held a post. */
export type DossierService = {
  role: string;
  organisation?: string | null;
  /** Free text, not a date: "2019", "2019 — 2024", "Spring 2021". */
  from?: string | null;
  to?: string | null;
  detail?: string | null;
};

/** Something they wrote: a post or a piece of writing, anywhere on the network. */
export type DossierDispatch = {
  id: string;
  title: string;
  href: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  /** ISO. Absent for an unpublished draft the author is previewing. */
  publishedAt?: string | null;
  /** The org it was filed under, for the kicker. */
  orgName?: string | null;
  kind?: string | null;
  /** True for a draft. Only ever reaches the renderer for the author. */
  draft?: boolean;
};

/** Something they are hosting: an event, a meeting, a workshop. */
export type DossierMovement = {
  id: string;
  title: string;
  href: string;
  /** ISO. Required — an undated thread is a dispatch, not a movement. */
  scheduledAt: string;
  durationMinutes?: number | null;
  location?: string | null;
  orgName?: string | null;
  kind?: string | null;
};

/** One of their gallery pages (user_galleries). */
export type DossierExhibit = {
  id: string;
  title: string;
  href: string;
  description?: string | null;
  coverUrl?: string | null;
  itemCount: number;
};

/** A piece listed in their marketplace store. */
export type DossierLot = {
  id: string;
  title: string;
  href: string;
  imageUrl?: string | null;
  /** Already formatted for display, e.g. "$420 CAD". Null when not priced. */
  price?: string | null;
  /** 'available' | 'reserved' | 'sold' */
  status?: string | null;
};

export type DossierStorefront = {
  name: string;
  href: string;
  lots: DossierLot[];
};

/** What they have filed under one org. */
export type DossierFiling = {
  id: string;
  title: string;
  href?: string | null;
  date?: string | null;
  draft?: boolean;
};

export type DossierOrgActivity = {
  orgId: string;
  orgName: string;
  href?: string | null;
  roleTitle?: string | null;
  filings: DossierFiling[];
};

export type DossierActivity = {
  orgs: DossierOrgActivity[];
  filingCount: number;
  mediaCount: number;
};

/**
 * Sections the person has switched on for their own profile
 * (`users.profile_sections`, migration 105). Keyed by the `profileSection`
 * value in the template manifest.
 *
 * Absent means off. That is deliberate: a section whose data happens to be
 * empty and a section the person has not asked for are different things, and
 * only the second should stay off once they publish something.
 */
export type DossierSections = Record<string, boolean>;

export type DossierProfileData = {
  slug: string;
  /** aliasName — headline subject name */
  name: string;
  /** occupation line. Null renders a ruled blank, not an em-dash. */
  occupation: string | null;
  /** "Chicago, IL". Null renders a ruled blank, not "Location withheld". */
  location: string | null;
  /** FILE STATUS line */
  dossier_status: string | null;
  /** NOTES paragraph(s) */
  bio: string | null;
  /** the clipped portrait */
  photo_url: string | null;
  /** KNOWN WORK — the plate wall */
  operations: DossierOperation[];
  /** IN PROGRESS: what they are working on */
  current_targets: string[];
  /** IN PROGRESS: what is next */
  projected_movements: string[];
  /** ASSOCIATES: confirmed collaborators */
  verified_contacts: string[];
  /** ASSOCIATES: who they are looking for */
  wanted_accomplices: string[];
  /** PATRONAGE — money links only. */
  financial_channels: DossierChannel[];
  /**
   * KNOWN ADDRESSES — website and social links.
   *
   * Separate from `financial_channels` because v0.1 had only the one bucket
   * and rendered every social link under the heading FINANCIAL CHANNELS.
   */
  channels: DossierChannel[];
  /** SERVICE RECORD */
  work_history: DossierService[];
  /** DISPATCHES */
  dispatches: DossierDispatch[];
  /** MOVEMENTS */
  movements: DossierMovement[];
  /** EXHIBITS */
  exhibits: DossierExhibit[];
  /** ACQUISITIONS */
  storefront: DossierStorefront | null;
  /** FILED ACTIVITY */
  activity: DossierActivity | null;
  /** Stamp + claim flow */
  claim_status: "unclaimed" | "pending" | "claimed";
  verified: boolean;
  /** Secure contact target (mailto: or url) for the identity CTA */
  contact_href?: string | null;
  /** Shown on the folder tab. Derived, stable per profile. */
  case_number?: string | null;
  /** Which optional sections this person has switched on. */
  sections?: DossierSections;
};

/** Pre-read HTML strings for each dossier template section. */
export type DossierTemplates = {
  nav: string;
  identity: string;
  operations: string;
  dispatches: string;
  movements: string;
  exhibits: string;
  acquisitions: string;
  record: string;
  intelligence: string;
  network: string;
  channels: string;
  funds: string;
  activity: string;
};

// ============================================================================
// Studio · Create (canvas A, "Studio pipeline frame", 2026-11-14). The data the
// Create screen draws, loaded per acting org by the host
// (apps/arts-collective/src/lib/studio-create-actions.ts). Plain data: the
// component never reads a database or a URL of its own.
// ============================================================================

/** One piece in Create's Library (the host maps @elkdonis/content listContent rows). */
export interface CreateLibraryItem {
  /** `<store>:<id>`, the Make into route's `from`. */
  key: string;
  /** A content type id ("writing", "meeting", "artwork"…). */
  type: string;
  /** "Writing", "Meeting"… */
  typeLabel: string;
  title: string;
  /** The row's detail line from the library ("Oil on linen · 60 × 90 cm"), may be empty. */
  meta: string;
  cover: string | null;
  /** draft | scheduled | live | published */
  status: string;
  /** ISO; the row's date. */
  date: string | null;
}

/** The first of the acting channel's next moves (Channel's list, the dock's and `channel-next`'s). */
export interface CreateNext {
  /** "Fri · Instagram slot", "Plan step · due today". */
  kicker: string;
  title: string;
  reason: string | null;
  href: string | null;
  /** The move's own open label ("Record", "Finish"), else "Open". */
  label: string;
}

/** A recording or file the person brought in that nothing has been made from yet (studio_items). */
export interface CreateMaterial {
  id: string;
  kind: 'recording' | 'file';
  title: string;
  /** ISO. */
  updatedAt: string;
}

/** The acting org's (or the person's) saved site colours and fonts, read-only. */
export interface CreateKit {
  colors: string[];
  fonts: string[];
  /** Where the kit is edited; null when this host has no editor for it. */
  editHref: string | null;
}

export interface StudioCreateData {
  library: CreateLibraryItem[];
  next: CreateNext | null;
  /** Further next moves beyond `next`. */
  nextMore: number;
  material: CreateMaterial[];
  /** Further unused items beyond `material`. */
  materialMore: number;
  kit: CreateKit;
}

export interface CreateKindProps {
  /** Create's data for the acting org (`oad` is "Just me"); null when signed out. */
  load: (orgId: string) => Promise<StudioCreateData | null>;
  /** The Make into route (`/studio/make`): `?from=<store:id>&to=<kind>&org=<org>`. */
  makeBase: string;
  /** This app's Channel (`/channel`); the acting org is added as `?org=`. */
  channelBase?: string | null;
  /** The booth, for people who may go live; the Live tile shows only with it. */
  liveHref?: string | null;
  /** The person's Nextcloud; the "From Nextcloud" button shows only with it. */
  nextcloudHref?: string | null;
}

import type {
  DossierProfileData,
  DossierChannel,
  DossierMovement,
  DossierSections,
} from "./types";

// ============================================================================
// DossierProfileData → the render context the manifest bindings read.
//
// ── Why this file exists at all ─────────────────────────────────────────────
//
// The binding engine's contract is that the MANIFEST declares wiring and
// nothing else: "anything conditional or pluralised belongs in a formatter,
// not in manifest syntax". A dossier is full of both — a plate is "Exhibit C",
// a gallery holds "18 plates", a movement is upcoming or it is history, a lot
// is priced or it is sold.
//
// Rather than grow a dozen one-off formatters, that work happens here, once,
// in typed TypeScript. What the manifest then needs is almost entirely
// `{ "kind": "text", "from": "..." }`, which is legible to anyone opening the
// JSON and mechanically checkable by validateBindings against a sample.
//
// It is the same split toWorkshopContext already makes.
// ============================================================================

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

/**
 * Only http(s), mailto and site-relative paths reach an href.
 *
 * Not optional and not deferrable to the caller: a dossier is a wiki page.
 * `users` rows on this directory are editable by any signed-in contributor on
 * an unclaimed profile, so a social link is untrusted input with a very short
 * path to a visitor's browser. The engine writes `attr` bindings verbatim, so
 * the filtering has to have happened by the time a value reaches the context.
 */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (/^\//.test(trimmed)) return trimmed;
  // A bare domain is the common honest case in a hand-typed link field.
  if (/^[\w.-]+\.[a-z]{2,}([/?#]|$)/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "12 Oct 2026" */
function formatDate(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * "7:00 PM" in ONE stated zone.
 *
 * Carried over from the feed formatter, whose reasoning holds here too: a
 * gathering happens at an address, and a traveller reading this needs the time
 * at the door, not the time where their laptop thinks it is.
 */
function formatTime(value: string | Date, timeZone?: string): string {
  const d = parseDate(value);
  if (!d) return "";
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  if (timeZone) opts.timeZone = timeZone;
  try {
    return new Intl.DateTimeFormat("en-CA", opts).format(d);
  } catch {
    // An invalid zone should cost the zone, not the time.
    delete opts.timeZone;
    return new Intl.DateTimeFormat("en-CA", opts).format(d);
  }
}

function durationLabel(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "A", "B", … "Z", "AA". */
function letter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

function ordinal(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "instagram.com/someone" — a link as it would be written down. */
function linkText(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

/**
 * The number on the folder tab.
 *
 * Derived from the slug rather than stored, so it is stable for a person
 * across renders and needs no column. Apparatus, not an identifier — nothing
 * looks anything up by it.
 */
export function caseNumber(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return String(h % 10000).padStart(4, "0");
}

function stamp(data: DossierProfileData): { label: string; state: string } {
  if (data.verified) return { label: "Verified", state: "verified" };
  if (data.claim_status === "claimed") return { label: "Claimed", state: "claimed" };
  if (data.claim_status === "pending") return { label: "Claim pending", state: "pending" };
  return { label: "Unclaimed", state: "unclaimed" };
}

/** Escaped paragraphs. The bio is wiki-editable text, never markup. */
function bioHtml(bio: string | null): string {
  if (!bio?.trim()) return "";
  return bio
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// ─── the context's own shapes ────────────────────────────────────────────────

export interface DossierPlate {
  id: string;
  href: string;
  src: string;
  caption: string;
}

export interface DossierContext {
  archive: { name: string; indexHref: string };
  subject: {
    name: string;
    occupation: string;
    location: string;
    fileStatus: string;
    bioHtml: string;
    photoUrl: string;
    photoAlt: string;
    contactHref: string;
    caseLabel: string;
    stampLabel: string;
    stampState: string;
  };
  work: {
    countLabel: string;
    items: Array<{
      ref: string;
      title: string;
      note: string;
      imageUrl: string;
      plateHref: string;
    }>;
  };
  dispatches: {
    countLabel: string;
    /**
     * Non-empty when the lead item has no cover image.
     *
     * A `class` binding can only ADD a class when its source is truthy, and the
     * class wanted here is the ABSENCE of a cover. Inverting it in the context
     * is the alternative to giving the engine a negated class binding that the
     * workshop template would never use.
     */
    leadNoCover: string;
    lead: {
      title: string;
      href: string;
      excerpt: string;
      coverImageUrl: string;
      meta: string;
      flag: string;
    } | null;
    rest: Array<{
      title: string;
      href: string;
      excerpt: string;
      meta: string;
      date: string;
      flag: string;
    }>;
  };
  movements: {
    upcoming: DossierMovementRow[];
    past: DossierMovementRow[];
  };
  exhibits: {
    countLabel: string;
    items: Array<{
      ref: string;
      title: string;
      href: string;
      coverUrl: string;
      countLabel: string;
    }>;
  };
  store: {
    name: string;
    href: string;
    lots: Array<{
      ref: string;
      title: string;
      href: string;
      imageUrl: string;
      plateHref: string;
      price: string;
      soldLabel: string;
    }>;
  } | null;
  record: Array<{ span: string; role: string; organisation: string; detail: string }>;
  progress: { working: string[]; next: string[] };
  associates: { works: string[]; wants: string[] };
  addresses: Array<{ label: string; href: string; text: string }>;
  support: Array<{ title: string; description: string; href: string }>;
  activity: {
    orgTags: Array<{ label: string; href: string }>;
    orgBlocks: Array<{
      name: string;
      href: string;
      filings: Array<{ title: string; href: string; date: string; flag: string }>;
    }>;
    tally: Array<{ n: string; label: string }>;
  } | null;
  plates: DossierPlate[];
}

interface DossierMovementRow {
  month: string;
  day: string;
  year: string;
  title: string;
  href: string;
  meta: string;
  time: string;
}

export interface DossierContextOptions {
  archiveName?: string;
  indexHref?: string;
  /** IANA zone the movement times are stated in. */
  timeZone?: string;
}

/**
 * Which sections have something to show.
 *
 * Two gates, both of which must pass: the person asked for the section
 * (`users.profile_sections`), and there is something in it. Sections with no
 * `profileSection` key in the manifest are governed by emptiness alone —
 * they are the file itself rather than something added to it.
 *
 * Returned as a set of section ids so the caller can both COMPOSE only these
 * (a server render) and REMOVE the rest (a Silex-published page) from one
 * answer, instead of two lists that can disagree.
 */
export function visibleDossierSections(data: DossierProfileData): Set<string> {
  const on = (key: string) => Boolean(data.sections?.[key]);
  const money = data.financial_channels.filter((c) => safeHref(c.url));
  const addresses = data.channels.filter((c) => safeHref(c.url));

  const visible = new Set<string>(["eac-dossier-nav", "eac-dossier-identity"]);
  const add = (id: string, keep: boolean) => {
    if (keep) visible.add(id);
  };

  add("eac-dossier-operations", data.operations.length > 0);
  add("eac-dossier-dispatches", on("dispatches") && data.dispatches.length > 0);
  add("eac-dossier-movements", on("movements") && data.movements.length > 0);
  add("eac-dossier-exhibits", on("galleries") && data.exhibits.length > 0);
  add("eac-dossier-acquisitions", on("store") && (data.storefront?.lots.length ?? 0) > 0);
  add("eac-dossier-record", on("workHistory") && data.work_history.length > 0);
  add(
    "eac-dossier-intelligence",
    data.current_targets.length > 0 || data.projected_movements.length > 0
  );
  add(
    "eac-dossier-network",
    data.verified_contacts.length > 0 || data.wanted_accomplices.length > 0
  );
  add("eac-dossier-channels", addresses.length > 0);
  add("eac-dossier-funds", money.length > 0);
  add("eac-dossier-activity", (data.activity?.orgs.length ?? 0) > 0);
  // Only worth emitting when a plate above actually links to one.
  add(
    "eac-dossier-lightbox",
    data.operations.some((o) => o.image_url) ||
      (on("store") ? (data.storefront?.lots.some((l) => l.imageUrl) ?? false) : false)
  );
  return visible;
}

function usableChannels(channels: DossierChannel[]) {
  return channels
    .map((c) => ({ ...c, href: safeHref(c.url) }))
    .filter((c): c is DossierChannel & { href: string } => Boolean(c.href));
}

function movementRow(m: DossierMovement, timeZone?: string): DossierMovementRow | null {
  const d = parseDate(m.scheduledAt);
  if (!d) return null;
  return {
    month: MONTHS[d.getUTCMonth()],
    day: String(d.getUTCDate()).padStart(2, "0"),
    year: String(d.getUTCFullYear()),
    title: m.title,
    href: safeHref(m.href) ?? "#",
    meta: [m.kind, m.location, durationLabel(m.durationMinutes), m.orgName]
      .filter(Boolean)
      .join(" · "),
    time: formatTime(m.scheduledAt, timeZone),
  };
}

export function toDossierContext(
  data: DossierProfileData,
  opts: DossierContextOptions = {}
): DossierContext {
  const st = stamp(data);
  const plates: DossierPlate[] = [];
  const plate = (src: string, caption: string): string => {
    const id = `dos-plate-${plates.length + 1}`;
    plates.push({ id, href: `#${id}`, src, caption });
    return `#${id}`;
  };

  const work = data.operations.map((op, i) => ({
    ref: `Exhibit ${letter(i)}`,
    title: op.title,
    note: [op.date, op.details].filter(Boolean).join(" · "),
    imageUrl: op.image_url ?? "",
    plateHref: op.image_url ? plate(op.image_url, op.title) : "",
  }));

  const [lead, ...rest] = data.dispatches;
  const dispatchMeta = (d: (typeof data.dispatches)[number]) =>
    [d.orgName, formatDate(d.publishedAt)].filter(Boolean).join(" · ");

  const rows = data.movements
    .map((m) => ({ m, row: movementRow(m, opts.timeZone) }))
    .filter((x): x is { m: DossierMovement; row: DossierMovementRow } => x.row !== null);
  // A gathering stays "upcoming" until six hours past its start, so someone
  // arriving late still sees where they were going. Same window the org feeds
  // use, deliberately — one definition of "over".
  const cutoff = Date.now() - 6 * 3600 * 1000;
  const upcoming = rows
    .filter((x) => +new Date(x.m.scheduledAt) >= cutoff)
    .sort((a, b) => +new Date(a.m.scheduledAt) - +new Date(b.m.scheduledAt))
    .map((x) => x.row);
  const past = rows
    .filter((x) => +new Date(x.m.scheduledAt) < cutoff)
    .sort((a, b) => +new Date(b.m.scheduledAt) - +new Date(a.m.scheduledAt))
    .map((x) => x.row);

  const storeHref = data.storefront ? safeHref(data.storefront.href) : null;

  return {
    archive: {
      name: opts.archiveName ?? "ArtDirect",
      indexHref: opts.indexHref ?? "/",
    },

    subject: {
      name: data.name,
      // Empty rather than "—" or "Location withheld": the template renders an
      // unfilled field as a ruled blank, which is what an unfilled form looks
      // like and is the only honest thing to say about a field nobody has
      // touched. Across the live directory that is every one of them.
      occupation: data.occupation ?? "",
      location: data.location ?? "",
      fileStatus: data.dossier_status ?? st.label,
      bioHtml: bioHtml(data.bio),
      photoUrl: data.photo_url ?? "",
      photoAlt: data.photo_url ? data.name : "",
      contactHref: safeHref(data.contact_href) ?? "",
      caseLabel: `Case no. ${data.case_number ?? caseNumber(data.slug)}`,
      stampLabel: st.label,
      stampState: st.state,
    },

    work: {
      countLabel: plural(data.operations.length, "on file", "on file"),
      items: work,
    },

    dispatches: {
      countLabel: plural(data.dispatches.length, "filed", "filed"),
      leadNoCover: lead && !lead.coverImageUrl ? "nocover" : "",
      lead: lead
        ? {
            title: lead.title,
            href: safeHref(lead.href) ?? "#",
            excerpt: lead.excerpt ?? "",
            coverImageUrl: lead.coverImageUrl ?? "",
            meta: dispatchMeta(lead),
            flag: lead.draft ? "Draft" : "",
          }
        : null,
      rest: rest.map((d) => ({
        title: d.title,
        href: safeHref(d.href) ?? "#",
        excerpt: d.excerpt ?? "",
        meta: d.orgName ?? "",
        date: formatDate(d.publishedAt),
        flag: d.draft ? "Draft" : "",
      })),
    },

    movements: { upcoming, past },

    exhibits: {
      countLabel: String(data.exhibits.length),
      items: data.exhibits.map((g, i) => ({
        ref: `Room ${ordinal(i)}`,
        title: g.title,
        href: safeHref(g.href) ?? "#",
        coverUrl: g.coverUrl ?? "",
        countLabel: plural(g.itemCount, "plate", "plates"),
      })),
    },

    store:
      data.storefront && storeHref
        ? {
            name: data.storefront.name,
            href: storeHref,
            lots: data.storefront.lots.map((lot, i) => ({
              ref: `Lot ${ordinal(i)}`,
              title: lot.title,
              href: safeHref(lot.href) ?? storeHref,
              imageUrl: lot.imageUrl ?? "",
              plateHref: lot.imageUrl ? plate(lot.imageUrl, lot.title) : "",
              // A price and a sold mark are mutually exclusive, and the
              // template shows whichever is non-empty. Deciding it here rather
              // than with two `show` bindings keeps "sold beats price" in one
              // place.
              price: lot.status === "sold" ? "" : (lot.price ?? ""),
              soldLabel: lot.status === "sold" ? "Sold" : "",
            })),
          }
        : null,

    record: data.work_history.map((e) => {
      const from = e.from?.trim();
      const to = e.to?.trim();
      return {
        span: from && to ? `${from} — ${to}` : from || to || "—",
        role: e.role,
        organisation: e.organisation ?? "",
        detail: e.detail ?? "",
      };
    }),

    progress: {
      working: data.current_targets,
      next: data.projected_movements,
    },

    associates: {
      works: data.verified_contacts,
      wants: data.wanted_accomplices,
    },

    addresses: usableChannels(data.channels).map((c) => ({
      label: c.title,
      href: c.href,
      text: linkText(c.href),
    })),

    support: usableChannels(data.financial_channels).map((c) => ({
      title: c.title || linkText(c.href),
      description: c.description ?? "",
      href: c.href,
    })),

    activity: data.activity
      ? {
          orgTags: data.activity.orgs
            .filter((o) => o.roleTitle || o.filings.length > 0)
            .map((o) => ({
              label: o.roleTitle ? `${o.orgName} — ${o.roleTitle}` : o.orgName,
              href: safeHref(o.href) ?? "",
            })),
          orgBlocks: data.activity.orgs
            .filter((o) => o.filings.length > 0)
            .map((o) => ({
              name: o.orgName,
              href: safeHref(o.href) ?? "",
              filings: o.filings.map((f) => ({
                title: f.title,
                href: safeHref(f.href) ?? "",
                date: formatDate(f.date),
                flag: f.draft ? "Unfiled" : "",
              })),
            })),
          tally: [
            {
              n: String(data.activity.orgs.length),
              label: data.activity.orgs.length === 1 ? "Organisation" : "Organisations",
            },
            {
              n: String(data.activity.filingCount),
              label: data.activity.filingCount === 1 ? "Filing" : "Filings",
            },
            {
              n: String(data.activity.mediaCount),
              label: data.activity.mediaCount === 1 ? "Item on file" : "Items on file",
            },
          ],
        }
      : null,

    plates,
  };
}

export type { DossierSections };

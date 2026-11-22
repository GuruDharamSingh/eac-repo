// The sample world seen through the shapes that blocks' resolvers return (a record, a payment, an answer to
// "are you coming", a post, a shelf card). Pure functions over ./world; nothing here is stored or fetched.

import { ARTWORKS, FORUM, GATHERINGS, SERVICES, SHOP_PIECE, WRITINGS, person, type Gathering, type Service, type Writing } from "./world";

export interface RecordViewShape {
  kind: string;
  kicker: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  authorName: string;
  authorHref: string;
  coverUrl: string | null;
  bodyHtml: string;
  facts: { label: string; value: string }[];
}

export function recordOfService(s: Service = SERVICES[0]): RecordViewShape {
  const host = person(s.hostId);
  return {
    kind: "service",
    kicker: "A service",
    title: s.title,
    subtitle: s.summary,
    dateLabel: "",
    authorName: host.name,
    authorHref: `/people/${host.slug}`,
    coverUrl: s.cover,
    bodyHtml: `<p>${s.summary}</p><p>Wear something you do not mind getting ink or clay on. Everything else is provided.</p>`,
    facts: [
      { label: "Price", value: s.priceLabel },
      { label: "Length", value: s.duration },
      { label: "Hosted by", value: host.name },
    ],
  };
}

export function recordOfGathering(g: Gathering = GATHERINGS[0]): RecordViewShape {
  const host = person(g.hostId);
  return {
    kind: "meeting",
    kicker: g.recurrence ?? "A gathering",
    title: g.title,
    subtitle: g.summary,
    dateLabel: g.when,
    authorName: host.name,
    authorHref: `/people/${host.slug}`,
    coverUrl: g.cover,
    bodyHtml: `<p>${g.summary}</p>`,
    facts: [
      { label: "When", value: g.when },
      { label: "Where", value: g.place ?? "Online" },
      { label: "Length", value: `${g.durationMinutes} minutes` },
      { label: "Coming", value: String(g.attending) },
    ],
  };
}

export function recordOfWriting(w: Writing = WRITINGS[0]): RecordViewShape {
  const author = person(w.authorId);
  return {
    kind: "post",
    kicker: "The journal",
    title: w.title,
    subtitle: w.lede,
    dateLabel: w.dateLabel,
    authorName: author.name,
    authorHref: `/people/${author.slug}`,
    coverUrl: w.cover,
    bodyHtml: w.bodyHtml,
    facts: [
      { label: "Reading time", value: `${w.readingMinutes} min` },
      { label: "By", value: author.name },
    ],
  };
}

/** `pay` for the checkout record part: a ranged price, open for booking. */
export function payOfService(s: Service = SERVICES[1]) {
  return { price: s.priceMax ?? s.price, priceMin: s.priceMax && s.price ? s.price : null, currency: s.currency, open: true, rangeNote: s.priceMax ? "Pay what suits you in this range." : null, note: "You pay on the secure card page." };
}

/** `attendance` for the rsvp record part. */
export function attendanceOfGathering(g: Gathering = GATHERINGS[0]) {
  return { open: true, mine: null, count: g.attending, signInHref: "/sign-in", closedLine: null };
}

/** A post as hidden-enneagram's he-post draws it. */
export function postView(w: Writing = WRITINGS[0]) {
  const author = person(w.authorId);
  return {
    id: w.id,
    kind: "post",
    feedSlug: w.feed,
    feedName: "The journal",
    title: w.title,
    excerpt: w.lede,
    bodyHtml: w.bodyHtml,
    authorName: author.name,
    authorSlug: author.slug,
    publishedAt: w.publishedAt,
    coverImageUrl: w.cover,
    membersOnly: w.membersOnly,
  };
}

/** Cards for a "shelf" block (title, href, kicker, blurb, meta, image). */
export function shelfCards(source: "services" | "feed" = "services") {
  if (source === "feed")
    return WRITINGS.map((w) => ({ id: w.id, title: w.title, href: `/${w.feed}/${w.slug}`, kicker: "The journal", blurb: w.lede, meta: `${w.readingMinutes} min`, image: w.cover }));
  return SERVICES.map((s) => ({ id: s.id, title: s.title, href: `/services/${s.slug}`, kicker: s.duration, blurb: s.summary, meta: s.priceLabel, image: s.cover }));
}

/** A forum board as a flat list. */
export const forumRows = () => FORUM.map((f) => ({ ...f, author: person(f.authorId).name }));

// ── shapes for the app-local artwork / potter / writing blocks ──────────────

/** An artwork as danamccool's blocks see it (ArtworkItem): minor-unit price, status, marketplace href. */
export function artworkItems() {
  return ARTWORKS.map((a) => ({
    id: a.id,
    title: a.title,
    year: a.year,
    medium: a.medium,
    dimensions: a.size,
    image: a.image,
    priceMinor: a.price == null ? 0 : a.price * 100,
    currency: "CAD",
    status: (a.status === "sold" ? "sold" : a.status === "not-for-sale" ? "portfolio" : "available") as "available" | "sold" | "portfolio",
    href: a.status === "not-for-sale" ? null : `/art/${a.slug}`,
  }));
}

/** The same, keyed by id (the resolver's `bound`). */
export function artworkBound() {
  return Object.fromEntries(artworkItems().map((a) => [a.id, a]));
}

/** The shop piece as katie-the-potter's blocks see it (Piece). */
export function potterPiece() {
  const p = SHOP_PIECE;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    year: p.year,
    medium: p.glaze,
    dimensions: p.size,
    kind: "original" as const,
    edition: null,
    priceMinor: p.price * 100,
    currency: "CAD",
    status: p.status,
    image: p.images[0] ?? null,
    images: p.images.map((url, i) => ({ url, alt: `${p.title}, view ${i + 1}` })),
    descriptionHtml: `<p>${p.blurb}</p>`,
    href: `/pieces/${p.slug}`,
  };
}

export const potterBound = () => ({ [SHOP_PIECE.id]: potterPiece() });

/** Writings as cms-ui's WritingShelf wants them (ShelfItem). */
export function shelfItemsOfWritings() {
  return WRITINGS.map((w) => ({ id: w.id, slug: w.slug, title: w.title, lede: w.lede, coverImageUrl: w.cover, status: "published" as const, publishedAt: w.publishedAt, readingMinutes: w.readingMinutes }));
}

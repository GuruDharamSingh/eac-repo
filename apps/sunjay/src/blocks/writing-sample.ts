// Example writing for the editor, shown only when the site has no listed pieces.

export interface WirePost {
  id: string;
  slug: string;
  title: string;
  lede: string | null;
  bodyHtml: string;
  coverImageUrl: string | null;
  layout: "essay" | "feature" | "note" | "announcement" | "document" | null;
  series: string | null;
  authorName: string | null;
  bylineName: string | null;
  readingMinutes: number | null;
  publishedAt: string | null;
}

export interface WireJournalItem {
  id: string;
  slug: string;
  title: string;
  lede: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  readingMinutes: number | null;
  authorName: string | null;
  series: string | null;
  href: string;
}

export const SAMPLE_POST: WirePost = {
  id: "sample-post",
  slug: "a-piece-of-writing",
  title: "A piece of writing",
  lede: "A standfirst: one or two sentences that say what this piece is about.",
  bodyHtml:
    "<p>The body of a piece comes from the writing room: paragraphs, headings, pull quotes and pictures set at content, wide or full width.</p><h2>A heading</h2><p>More words. The layout, series and byline are set per piece in the writing room.</p>",
  coverImageUrl: null,
  layout: "essay",
  series: "Notes from the lab",
  authorName: "The author",
  bylineName: null,
  readingMinutes: 3,
  publishedAt: "2026-09-20T12:00:00.000Z",
};

export const SAMPLE_JOURNAL: WireJournalItem[] = [
  { id: "j1", slug: "first-piece", title: "A first piece", lede: "Its standfirst appears here under the title.", coverImageUrl: null, publishedAt: "2026-09-20T12:00:00.000Z", readingMinutes: 4, authorName: "The author", series: "Notes from the lab", href: "/journal/first-piece" },
  { id: "j2", slug: "second-piece", title: "A second piece", lede: "Another standfirst.", coverImageUrl: null, publishedAt: "2026-09-12T12:00:00.000Z", readingMinutes: 2, authorName: "The author", series: "Notes from the lab", href: "/journal/second-piece" },
  { id: "j3", slug: "third-piece", title: "A third piece", lede: null, coverImageUrl: null, publishedAt: "2026-09-02T12:00:00.000Z", readingMinutes: 6, authorName: "A guest", series: null, href: "/journal/third-piece" },
];

// ── a post (2026-11-14, the post-detail template) ───────────────────────────
// A forum or section post (`threads.kind = 'post'`), as /<feed>/<slug> draws it. Not a Studio piece: those are
// `kind = 'writing'` and live under /journal (WirePost above).

export interface WirePostThread {
  id: string;
  title: string;
  excerpt: string | null;
  bodyHtml: string;
  authorName: string | null;
  publishedAt: string | null;
  coverImageUrl: string | null;
  feedSlug: string | null;
  feedName: string | null;
}

export const SAMPLE_POST_THREAD: WirePostThread = {
  id: "sample-post-thread",
  title: "A post from one of the site's sections",
  excerpt: "Its summary appears here, under the title.",
  bodyHtml: "<p>The body of a post, as its author wrote it in the section. Every post on the site is drawn with this layout.</p>",
  authorName: "The author",
  publishedAt: "2026-10-19T12:00:00.000Z",
  coverImageUrl: null,
  feedSlug: "materials",
  feedName: "Materials",
};

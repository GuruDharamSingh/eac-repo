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

import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { ArticleView } from "@elkdonis/cms-ui/article";
import { WritingShelf, type ShelfItem } from "@elkdonis/cms-ui/writing";
import { SAMPLE_JOURNAL, SAMPLE_POST, type WireJournalItem, type WirePost } from "./writing-sample";

// ============================================================================
// The writing blocks: Studio pieces on a Puck page.
//
//   pt-journal      the site's pieces as the Studio listing cards
//                   (cms-ui WritingShelf: lead piece with its cover, then rows)
//   pt-article      one piece in the reading layer (cms-ui ArticleView), with
//                   the layout, series and byline set in the writing room
//   pt-series-nav   the other pieces in this piece's series
//
// What a piece contains is set in Studio, not here: the body is the HTML the
// essay canvas rendered (`threads.body`), with its content / wide / full
// width grid from article.css. These blocks place it. Server-safe, no hooks.
// ============================================================================

const journalProps = [
  { name: "heading", kind: "string", label: "Heading", default: "Writing" },
  { name: "intro", kind: "text", label: "Line under the heading", default: "" },
  { name: "limit", kind: "number", label: "How many pieces", default: 12, min: 1, max: 50, step: 1 },
  { name: "series", kind: "string", label: "Only this series", description: "Empty lists everything.", default: "" },
  { name: "lead", kind: "boolean", label: "Set the newest piece larger, with its cover", default: true },
  { name: "emptyNote", kind: "string", label: "When there is nothing", default: "Nothing is published here yet." },
] as const;

export function Journal({
  items = [],
  heading = "Writing",
  intro = "",
  lead = true,
  emptyNote = "Nothing is published here yet.",
}: PropsOf<typeof journalProps> & { items?: WireJournalItem[] }) {
  const shelf: ShelfItem[] = items.map((i) => ({
    id: i.id,
    slug: i.slug,
    title: i.title,
    lede: i.lede,
    coverImageUrl: i.coverImageUrl,
    publishedAt: i.publishedAt,
    readingMinutes: i.readingMinutes,
    authorName: i.authorName,
    href: i.href,
    status: "published",
  }));
  return (
    <WritingShelf
      items={shelf}
      basePath="/journal"
      heading={heading}
      kicker={null}
      intro={intro || null}
      lead={lead}
      emptyNote={emptyNote}
    />
  );
}

export const journal = defineBlock(
  {
    id: "pt-journal",
    category: "listings",
    label: "Writing cards (Studio)",
    description:
      "Pieces written in the writing room and shown on this site, as the Studio listing: the newest large with its cover, the rest as rows.",
    memberSafe: true,
    dataDriven: true,
    styling: "tailwind",
    props: journalProps,
  },
  Journal,
  () => ({ heading: "Writing", limit: 12, lead: true, items: SAMPLE_JOURNAL })
);

// ── article ─────────────────────────────────────────────────────────────────

const articleProps = [
  {
    name: "piece",
    kind: "string",
    label: "Piece",
    description: "The piece's address. Empty draws the piece being visited (/journal/…), else the newest.",
    default: "",
  },
  {
    name: "reading",
    kind: "select",
    label: "Reading voice",
    default: "journal",
    options: [
      { value: "journal", label: "Journal — serif, ruled" },
      { value: "gazette", label: "Gazette — newspaper" },
      { value: "quiet", label: "Quiet — sans, restrained" },
    ],
  },
  { name: "showBack", kind: "boolean", label: "“← Writing” link above", default: true },
  { name: "showCover", kind: "boolean", label: "Cover picture", default: true },
] as const;

export function Article({
  post,
  reading = "journal",
  showBack = true,
  showCover = true,
}: PropsOf<typeof articleProps> & { post?: WirePost | null }) {
  if (!post) return <p className="card-natural p-6 text-sm text-muted-foreground">No piece to show yet.</p>;
  return (
    <div>
      {showBack ? (
        <a href="/journal" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Writing
        </a>
      ) : null}
      <ArticleView
        title={post.title}
        lede={post.lede}
        bodyHtml={post.bodyHtml}
        authorName={post.bylineName ?? post.authorName}
        publishedAt={post.publishedAt}
        coverImageUrl={showCover ? post.coverImageUrl : null}
        readingMinutes={post.readingMinutes}
        layout={post.layout}
        series={post.series}
        reading={reading as "journal" | "gazette" | "quiet"}
        kindLabel="Writing"
        threadId={post.id}
      />
    </div>
  );
}

export const article = defineBlock(
  {
    id: "pt-article",
    category: "content",
    label: "Piece (article)",
    description:
      "One written piece in the reading layer, with the layout, series and byline chosen in the writing room.",
    memberSafe: true,
    dataDriven: true,
    styling: "tailwind",
    props: articleProps,
  },
  Article,
  () => ({ reading: "journal" as const, showBack: true, showCover: true, post: SAMPLE_POST })
);

// ── series ──────────────────────────────────────────────────────────────────

const seriesProps = [{ name: "heading", kind: "string", label: "Heading", default: "In this series" }] as const;

export function SeriesNav({
  items = [],
  series = null,
  current = null,
  heading = "In this series",
}: PropsOf<typeof seriesProps> & { items?: WireJournalItem[]; series?: string | null; current?: string | null }) {
  if (!series || items.length < 2) return null;
  return (
    <nav aria-label={series} className="card-natural p-6">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{heading}</p>
      <h2 className="mt-1 font-serif text-xl">{series}</h2>
      <ol className="mt-4 space-y-2 text-sm">
        {items.map((i) => (
          <li key={i.id}>
            {i.slug === current ? (
              <span aria-current="page" className="font-medium text-[hsl(var(--primary))]">
                {i.title}
              </span>
            ) : (
              <a href={i.href} className="underline-offset-4 hover:underline">
                {i.title}
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export const seriesNav = defineBlock(
  {
    id: "pt-series-nav",
    category: "listings",
    label: "Series list",
    description: "The other pieces filed under this piece's series. Hidden when the piece has no series.",
    memberSafe: true,
    dataDriven: true,
    styling: "tailwind",
    props: seriesProps,
  },
  SeriesNav,
  () => ({ heading: "In this series", series: "Notes from the lab", current: "first-piece", items: SAMPLE_JOURNAL.slice(0, 2) })
);

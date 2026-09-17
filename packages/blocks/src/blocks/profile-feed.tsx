import { defineBlock, type PropsOf } from "../registry";
import { ThreadFeed, type ThreadFeedItem, type ThreadFeedProps } from "./thread-feed";

// ============================================================================
// What one PERSON has published.
//
// Every feed in this package so far asks "what has this ORGANISATION put out".
// A profile page asks the other question, and the difference is one column in
// the WHERE clause — but until now there was no block for it, so the question
// got answered by hand-written JSX on ArtDirect, on IFAC, and in the dossier
// template, three times, three ways.
//
// ── Why one block and not three ─────────────────────────────────────────────
//
// "Their writing", "their events" and "everything they've filed" are the same
// rows with a different `kind` filter and a different sort. Three blocks would
// be three copies of the same markup differing in two constants, which is the
// shape the component census already found 56 times in this repo. So it is one
// block with a `source` setting — the choice an author actually makes, offered
// as a choice.
//
// The rendering half is ThreadFeed itself, unchanged. A person's post and an
// org's post are the same object; only the question was different.
// ============================================================================

const props = [
  {
    name: "source",
    kind: "select",
    label: "What to show",
    description: "Which of this person's threads the feed asks for.",
    default: "writing",
    options: [
      { value: "writing", label: "Their writing — posts and essays" },
      { value: "events", label: "Their events — what they are hosting" },
      { value: "everything", label: "Everything they have filed" },
    ],
  },
  {
    name: "layout",
    kind: "select",
    label: "Layout",
    default: "list",
    options: [
      { value: "list", label: "List" },
      { value: "grid", label: "Grid" },
    ],
  },
  {
    name: "limit",
    kind: "number",
    label: "How many to show",
    default: 8,
  },
  {
    name: "showCovers",
    kind: "boolean",
    label: "Show cover images",
    default: true,
  },
  {
    name: "emptyMessage",
    kind: "string",
    label: "Message when there is nothing",
    default: "Nothing published yet.",
  },
  {
    name: "timeZone",
    kind: "string",
    label: "Time zone",
    description:
      "IANA zone the times are shown in, e.g. America/Toronto. Leave empty to use the reader's own.",
  },
] as const;

export type ProfileFeedSource = "writing" | "events" | "everything";

export type ProfileFeedProps = PropsOf<typeof props> & {
  items: ThreadFeedItem[];
};

export function ProfileFeed({ source: _source, ...feed }: ProfileFeedProps) {
  // `source` is a question for the loader, not a display setting, so it stops
  // here rather than reaching the DOM as a stray attribute.
  return <ThreadFeed {...(feed as ThreadFeedProps)} />;
}

export const profileFeed = defineBlock(
  {
    id: "profile-feed",
    category: "listings",
    label: "Their writing & events",
    description:
      "What one person has published across the network — their posts, the events they host, or everything they have filed.",
    props,
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
    silexRoot: "eac-dossier-dispatches",
  },
  ProfileFeed,
  () => ({
    source: "writing" as const,
    items: [
      {
        id: "sample-1",
        title: "On painting the hours a city is least watched",
        href: "#",
        kind: "post",
        kicker: "Elkdonis Arts Collective",
        excerpt:
          "The studio empties at seven and the light stops behaving. Notes from four winters of working after everyone has gone home.",
        authorName: null,
      },
      {
        id: "sample-2",
        title: "Notes on infrared film",
        href: "#",
        kind: "writing",
        kicker: "IFAC",
        excerpt: "A darkroom process worked out over one winter, and the three things that go wrong.",
      },
    ],
  })
);

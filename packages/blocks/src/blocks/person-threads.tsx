import { PersonThreadList, type PersonListItem } from "@elkdonis/cms-ui/profile";
import { defineBlock, type PropsOf } from "../registry";
import { PersonBlockNote, type PuckContext } from "./person-note";

// ============================================================================
// Their posts, events or services — PersonPage's thread lists as one block.
//
// Not profile-feed: that block asks getAuthoredThreads and draws ThreadFeed
// cards; a person page lists posts and events as the plain page does
// (getPersonPage's `posts`/`events`, linked on their home sites).
// ============================================================================

const props = [
  {
    name: "source",
    kind: "select",
    label: "What to list",
    default: "posts",
    options: [
      { value: "posts", label: "Their posts" },
      { value: "events", label: "Their events" },
      { value: "services", label: "Their services" },
    ],
  },
  { name: "heading", kind: "string", label: "Heading", description: "Leave empty for Posts, Events or Services." },
] as const;

const WORDS = {
  posts: { title: "Posts", empty: "Nothing posted yet." },
  events: { title: "Events", empty: "No events yet." },
  services: { title: "Services", empty: "No services yet." },
} as const;

export type PersonThreadsProps = PropsOf<typeof props> & {
  entries?: PersonListItem[];
  off?: boolean;
  editable?: boolean;
  puck?: PuckContext;
};

export function PersonThreads({ source = "posts", heading, entries = [], off, editable, puck }: PersonThreadsProps) {
  const words = WORDS[source as keyof typeof WORDS] ?? WORDS.posts;
  const title = (typeof heading === "string" && heading.trim()) || words.title;
  if (off) {
    return <PersonBlockNote puck={puck}>{`${words.title} are switched off in your page settings.`}</PersonBlockNote>;
  }
  const empty = editable || puck?.isEditing ? words.empty : null;
  if (entries.length === 0 && !empty) return null;
  return (
    <div className="blk-person-section">
      <PersonThreadList title={title} items={entries} empty={empty} />
    </div>
  );
}

export const personThreads = defineBlock(
  {
    id: "person-threads",
    category: "listings",
    label: "Their posts, events or services",
    description: "A list of their posts, events or services, each linked where it was published.",
    props,
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
  },
  PersonThreads,
  () => ({
    source: "posts" as const,
    entries: [
      { href: "#", title: "Open studio this weekend", meta: "3 Oct 2026 · on IFAC" },
      { href: "#", title: "A new edition", meta: "12 Sept 2026 · on Elkdonis Arts Collective" },
    ],
  })
);

/**
 * The catalogue of components that can appear inside authored content.
 *
 * This is the single source of truth for what an embeddable component is
 * called and what it accepts. It lives next to the renderer on purpose: adding
 * a component should mean editing one registry, not hunting down every place
 * that needs to know about it.
 *
 * Three consumers, all reading the same table:
 *   - renderSilexHtmlWithEmbeds (embeds.tsx) turns markers into React
 *   - a content compiler turns authored tags into markers
 *   - an editor UI can offer a picker built from this list
 *
 * Deliberately free of React and of any Node built-in, so a compiler or a
 * client-side picker can import it without pulling the renderer in behind it.
 */

export type EmbedPropKind = "string" | "number" | "list";

export type EmbedProp = {
  /** Attribute suffix: `limit` becomes data-limit. */
  name: string;
  kind: EmbedPropKind;
  description: string;
};

export type EmbedComponent = {
  /** Value of data-eac-component, and the authored tag name in lower case. */
  id: string;
  /** Tag an author writes, e.g. <Rsvp />. */
  tag: string;
  label: string;
  description: string;
  props: EmbedProp[];
  /**
   * Whether an untrusted author (any member) may place this component.
   * Everything currently in the catalogue is read-only or already
   * permission-gated at render time, so all are safe; the flag exists so that
   * adding a privileged component later is a deliberate act.
   */
  memberSafe: boolean;
};

/** Props every component accepts. */
const COMMON_PROPS: EmbedProp[] = [
  { name: "title", kind: "string", description: "Heading shown above the block." },
  {
    name: "variant",
    kind: "string",
    description: "Set to `inline` to render without the section wrapper.",
  },
];

const LIMIT: EmbedProp = {
  name: "limit",
  kind: "number",
  description: "How many items to show (1–8).",
};

export const EMBED_COMPONENTS: EmbedComponent[] = [
  {
    id: "rsvp",
    tag: "Rsvp",
    label: "RSVP",
    description: "Upcoming sessions with a join/RSVP action.",
    props: [...COMMON_PROPS, LIMIT],
    memberSafe: true,
  },
  {
    id: "login",
    tag: "Login",
    label: "Sign in",
    description: "Sign-in state for this organisation, resolved server-side.",
    props: [
      ...COMMON_PROPS,
      {
        name: "description",
        kind: "string",
        description: "Prompt shown to signed-out readers.",
      },
    ],
    memberSafe: true,
  },
  {
    id: "media-upload",
    tag: "MediaUpload",
    label: "Media upload",
    description:
      "Upload box for org members. Non-members see an explanatory notice.",
    props: [
      ...COMMON_PROPS,
      {
        name: "accept",
        kind: "string",
        description: "File input accept list. Defaults to images and video.",
      },
    ],
    memberSafe: true,
  },
  {
    id: "directory",
    tag: "Directory",
    label: "Member directory",
    description:
      "The people published on this organisation, with portraits and roles.",
    props: [
      ...COMMON_PROPS,
      LIMIT,
      {
        name: "tags",
        kind: "list",
        description:
          "Only show people carrying these org tags, e.g. `artist` or `dealer`.",
      },
    ],
    memberSafe: true,
  },
  {
    id: "workshop-cards",
    tag: "WorkshopCards",
    label: "Workshop cards",
    description: "This organisation's workshops and offerings.",
    props: [...COMMON_PROPS, LIMIT],
    memberSafe: true,
  },
  {
    id: "org-feed",
    tag: "OrgFeed",
    label: "Organisation feed",
    description: "Recent published content from this organisation.",
    props: [...COMMON_PROPS, LIMIT],
    memberSafe: true,
  },
  {
    id: "community-feed",
    tag: "CommunityFeed",
    label: "Community feed",
    description: "Recent activity from across the network.",
    props: [...COMMON_PROPS, LIMIT],
    memberSafe: true,
  },
  {
    id: "inquiry",
    tag: "Inquiry",
    label: "Contact form",
    description: "Sends an inquiry to this organisation.",
    props: COMMON_PROPS,
    memberSafe: true,
  },
  {
    id: "countdown",
    tag: "Countdown",
    label: "Countdown",
    description: "Counts down to the next scheduled session.",
    props: COMMON_PROPS,
    memberSafe: true,
  },
  {
    id: "live",
    tag: "Live",
    label: "Live now",
    description: "Shows whether a session is currently live.",
    props: [
      ...COMMON_PROPS,
      { name: "status", kind: "string", description: "Override status text." },
    ],
    memberSafe: true,
  },
  {
    id: "poll",
    tag: "Poll",
    label: "Poll",
    description: "A question with options.",
    props: [
      ...COMMON_PROPS,
      { name: "question", kind: "string", description: "The question asked." },
      {
        name: "options",
        kind: "list",
        description: "Pipe-separated answers, e.g. `Yes|No|Maybe`.",
      },
      { name: "poll-type", kind: "string", description: "Poll style." },
    ],
    memberSafe: true,
  },
  {
    id: "resources",
    tag: "Resources",
    label: "Resources",
    description: "A list of linked resources.",
    props: [
      ...COMMON_PROPS,
      { name: "items", kind: "list", description: "Pipe-separated item labels." },
    ],
    memberSafe: true,
  },
];

const BY_TAG = new Map(
  EMBED_COMPONENTS.map((c) => [c.tag.toLowerCase(), c])
);
const BY_ID = new Map(EMBED_COMPONENTS.map((c) => [c.id, c]));

export function findComponentByTag(tag: string): EmbedComponent | null {
  return BY_TAG.get(tag.trim().toLowerCase()) ?? null;
}

export function findComponentById(id: string): EmbedComponent | null {
  return BY_ID.get(id.trim().toLowerCase()) ?? null;
}

/** Attribute values are escaped, so authored text can never break out. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Turn an authored component and its props into the marker that
 * renderSilexHtmlWithEmbeds understands.
 *
 * Unknown components return null rather than emitting a marker — an author's
 * typo should disappear, never become a mystery empty block. Unknown props are
 * dropped for the same reason: only what the registry declares gets through,
 * which is what keeps authored content from smuggling arbitrary attributes
 * into the rendered page.
 */
export function componentToEmbedMarker(
  tag: string,
  props: Record<string, string | number | undefined> = {}
): string | null {
  const component = findComponentByTag(tag);
  if (!component) return null;

  const attrs: string[] = [`data-eac-component="${component.id}"`];

  for (const prop of component.props) {
    const raw = props[prop.name];
    if (raw === undefined || raw === null || raw === "") continue;
    attrs.push(`data-${prop.name}="${escapeAttr(String(raw))}"`);
  }

  return `<eac-embed ${attrs.join(" ")}></eac-embed>`;
}

import type { PageTemplate, TemplateNode } from "@elkdonis/blocks";

// ============================================================================
// The starting document for an org's landing page.
//
// Built from the org's identity at the moment the editor opens, so the page
// shows the org from the first second: its name and headline in the banner,
// its logo beside its statement, the offering card, what's on, its people and
// its links. Data blocks store settings only; their rows come from the
// resolvers. After the first publish the page owns its words — Settings →
// Identity still edits the profile page, not this one.
// ============================================================================

export interface OrgHomeSeed {
  orgName: string;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  socialLinks: Array<{ label: string | null; url: string }>;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const paragraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

const hostOf = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

export function orgHomeContent(seed: OrgHomeSeed): TemplateNode[] {
  const statement = seed.bio?.trim()
    ? paragraphs(seed.bio)
    : "<p>Say what this collective is for, who it is made of, and what it does.</p>";

  const nodes: TemplateNode[] = [
    {
      type: "hero-banner",
      props: {
        title: seed.orgName,
        subtitle: seed.headline ?? "",
        imageUrl: "",
        imageAlt: "",
        align: "center",
        height: 360,
      },
    },
    seed.avatarUrl
      ? {
          type: "text-image",
          props: {
            src: seed.avatarUrl,
            alt: seed.orgName,
            body: statement,
            place: "left",
            size: 32,
            offsetY: 0,
            wrap: "square",
            align: "start",
            ratio: "auto",
            caption: "",
            gap: "regular",
          },
        }
      : { type: "prose", props: { body: statement, size: "regular", align: "start", measure: true } },
    {
      type: "ac-offering",
      props: {
        heading: "Now",
        showImage: true,
        showExcerpt: true,
        buttonLabel: "Read more",
        emptyMessage: "Nothing on offer just now. Check back soon.",
      },
    },
    {
      type: "section-heading",
      props: { title: "What's on", eyebrow: "", subtitle: "", level: "h2", align: "left", rule: true },
    },
    {
      type: "thread-feed",
      props: { layout: "list", limit: 6, showCovers: true, emptyMessage: "Nothing published yet.", timeZone: "" },
    },
    { type: "ac-people", props: { heading: "People", showPhotos: true, showRoles: false, emptyMessage: "No members listed." } },
  ];

  if (seed.socialLinks.length > 0) {
    nodes.push(
      { type: "section-heading", props: { title: "Elsewhere", eyebrow: "", subtitle: "", level: "h2", align: "left", rule: true } },
      {
        type: "entry-list",
        props: {
          entries: seed.socialLinks.map((l) => ({ year: "", text: l.label ?? hostOf(l.url), detail: "", href: l.url })),
          align: "column",
          rules: true,
        },
      }
    );
  }

  nodes.push({ type: "link-button", props: { label: `About ${seed.orgName}`, href: "/profile", tone: "outline", align: "center", newTab: false } });
  return nodes;
}

export function orgHomeTemplate(seed: OrgHomeSeed): PageTemplate {
  return {
    id: "org-home",
    name: "Your site, as it is",
    description:
      "Your name and headline in a banner, your logo beside your statement, the offering card, what's on, your people and your links.",
    swatch: { ground: "#faf8f4", ink: "#1f1d1a", accent: "#6b4fbb" },
    cards: "Site blocks",
    content: orgHomeContent(seed),
  };
}

/** A starting point with none of the identity filled in: a banner and a text band. */
export function blankOrgTemplate(orgName: string): PageTemplate {
  return {
    id: "org-blank",
    name: "Plain page",
    description: "A banner and one block of text, for a page of words.",
    swatch: { ground: "#faf8f4", ink: "#1f1d1a", accent: "#6b4fbb" },
    cards: "None",
    content: [
      { type: "hero-banner", props: { title: orgName, subtitle: "", imageUrl: "", imageAlt: "", align: "center", height: 280 } },
      { type: "prose", props: { body: "<p>Write here.</p>", size: "regular", align: "start", measure: true } },
    ],
  };
}

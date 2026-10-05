import type { PageTemplate, TemplateNode } from "@elkdonis/blocks";

// ============================================================================
// The home page, as blocks.
//
// A copy of the landing page as it stood on 2026-10-01 (app/page.tsx,
// `LegacyHome`), expressed as the document the editor saves: the same bands in
// the same order, with the words the owner has written in /manage/pages and the
// photograph set in site_config `image_spaces` copied in at the moment the
// template is applied. After that the page owns them; /manage/pages still
// edits the footer, which is chrome.
//
//   banner                         pt-banner
//   next gathering                 pt-band(plain, small) > pt-standing
//   profile | calendar             pt-band(raised) > split-row > pt-profile | pt-calendar
//   materials + from | sign up     pt-band > split-row > (pt-threads, pt-threads) | pt-member
//   about                          pt-band(raised, narrow) > heading, prose, link
//   forum                          pt-band > pt-forum
//   writing, gallery               pt-band > pt-writing / pt-gallery — only
//                                  seeded when they have something to show,
//                                  because a band around nothing is an empty gap
//
// Data-driven blocks store settings only; their rows are fetched at render.
// ============================================================================

export interface HomeSeed {
  hero: { title?: string; subtitle?: string; body?: string; ctaLabel?: string; ctaHref?: string };
  heroImage: { url: string | null; alt: string };
  materials: { title?: string; body?: string };
  about: { title?: string; body?: string };
  orgName: string;
  tagline: string;
  guideShortName: string;
  hasWriting: boolean;
  hasGallery: boolean;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const paragraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

const band = (
  ground: "plain" | "raised",
  padding: "small" | "regular",
  width: "narrow" | "wide",
  rule: boolean,
  content: TemplateNode[]
): TemplateNode => ({ type: "pt-band", props: { ground, padding, width, rule, content } });

export function homeContent(seed: HomeSeed): TemplateNode[] {
  const nodes: TemplateNode[] = [
    {
      type: "pt-banner",
      props: {
        title: seed.hero.title || seed.orgName,
        subtitle: seed.hero.subtitle || seed.tagline,
        body: seed.hero.body ?? "",
        ctaLabel: seed.hero.ctaLabel ?? "",
        ctaHref: seed.hero.ctaHref ?? "",
        imageUrl: seed.heroImage.url ?? "",
        imageAlt: seed.heroImage.alt,
        scrim: 80,
        align: "center",
        size: "regular",
      },
    },

    band("plain", "small", "wide", false, [{ type: "pt-standing", props: { tall: true } }]),

    band("raised", "regular", "wide", true, [
      {
        type: "split-row",
        props: {
          ratio: "even",
          align: "start",
          gap: "regular",
          columns: "stacked",
          start: [{ type: "pt-profile", props: { showLinks: true, linkLabel: "Read more" } }],
          end: [{ type: "pt-calendar", props: {} }],
        },
      },
    ]),

    band("plain", "regular", "wide", true, [
      {
        type: "split-row",
        props: {
          ratio: "even",
          align: "start",
          gap: "loose",
          columns: "stacked",
          start: [
            {
              type: "pt-threads",
              props: {
                heading: seed.materials.title || "Suggested materials",
                intro: seed.materials.body ?? "",
                rule: true,
                source: "feed",
                feed: "materials",
                limit: 4,
                layout: "cards",
                cardLabel: "Materials",
                emptyMessage: "Nothing here yet. Check back soon.",
              },
            },
            {
              type: "pt-threads",
              props: {
                heading: `From ${seed.guideShortName}`,
                intro: "",
                rule: true,
                source: "author",
                feed: "",
                limit: 5,
                layout: "list",
                emptyMessage: "Nothing published yet.",
              },
            },
          ],
          end: [{ type: "pt-member", props: { showMembership: true } }],
        },
      },
    ]),

    band("raised", "regular", "narrow", true, [
      { type: "pt-heading", props: { text: seed.about.title || "About", level: "2", rule: true, align: "left" } },
      { type: "prose", props: { body: paragraphs(seed.about.body ?? "") } },
      { type: "pt-link", props: { label: "Who teaches here →", href: "/about", look: "text" } },
    ]),

    band("plain", "regular", "wide", true, [{ type: "pt-forum", props: { heading: "Forum" } }]),
  ];

  if (seed.hasWriting) {
    nodes.push(
      band("raised", "regular", "wide", true, [
        { type: "pt-writing", props: { heading: "Writing", limit: 6, allLabel: "All writing →", allHref: "/writing" } },
      ])
    );
  }
  if (seed.hasGallery) {
    nodes.push(
      band("plain", "regular", "wide", true, [
        { type: "pt-gallery", props: { heading: "Gallery", limit: 12, autoAdvanceSeconds: 0 } },
      ])
    );
  }
  return nodes;
}

export function homeTemplate(seed: HomeSeed): PageTemplate {
  return {
    id: "para-theater-home",
    name: "Para Theater home",
    description:
      "The landing page as it was: banner, next gathering, profile beside the calendar, materials beside sign-up, about, forum.",
    swatch: { ground: "#1B1E20", ink: "#E9E5DD", accent: "#C9AE79" },
    cards: "Site cards",
    content: homeContent(seed),
  };
}

/** A starting point for any other page: a title banner, then one band to fill. */
export function blankTemplate(orgName: string): PageTemplate {
  return {
    id: "para-theater-page",
    name: "Plain page",
    description: "A heading band and one text band, for a page of words.",
    swatch: { ground: "#1B1E20", ink: "#E9E5DD", accent: "#C9AE79" },
    cards: "None",
    content: [
      {
        type: "pt-banner",
        props: { title: "Page title", subtitle: orgName, body: "", imageUrl: "", scrim: 80, align: "center", size: "compact" },
      },
      band("plain", "regular", "narrow", false, [
        { type: "pt-heading", props: { text: "A heading", level: "2", rule: true, align: "left" } },
        { type: "prose", props: { body: "<p>Write here.</p>" } },
      ]),
    ],
  };
}

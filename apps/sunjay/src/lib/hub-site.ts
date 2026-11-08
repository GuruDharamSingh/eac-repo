import "server-only";

// Para Theater as a hub card host (docs/open/hub-cards-handoff/PLAN.md §1.2, §3).
// `hubSite` is the plain site object the shared cards take, with the Site
// Builder declaration: which pages are fixed layouts with copy slots (the
// copy the old /manage/pages editor wrote), the shared layouts, the theme
// defaults from globals.css. When the org-site kit lands, this moves into
// defineSite.

import { db } from "@elkdonis/db";
import type { HubSite, HubViewer } from "@elkdonis/hub/contract";
import type { SiteBuilderDeclaration } from "@elkdonis/hub/site-builder/model";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

const siteBuilder: SiteBuilderDeclaration = {
  look: "paper",
  maxDepth: 1, // flat: a nested path would collide with /[feed]/[slug]
  pathOf: { home: "", landing: "" },
  sharedLayouts: [
    { key: "event-detail", title: "Event page layout", draws: "Draws every event page" },
    { key: "journal-piece", title: "Journal piece layout", draws: "Draws every journal piece" },
  ],
  pageStarts: [
    { id: "blank", name: "Blank", note: "An empty page. Add blocks in the editor." },
    { id: "services", name: "Services", note: "Services as cards, one in full, a booking form." },
    { id: "writing", name: "Writing", note: "An index of pieces from the writing room." },
  ],
  theme: {
    headingFont: "Fraunces",
    bodyFont: "Spectral",
    // globals.css (:root): slate ground, raised card, warm bone, bronze.
    colors: {
      paper: "#1b1e20",
      surface: "#24282a",
      ink: "#e9e5dd",
      line: "#373c3f",
      accent: "#c9ae79",
      accent2: "#6b7478",
      frame: "#373c3f",
    },
  },
  templatePages: [
    {
      path: "",
      title: "Home",
      slots: [
        { key: "hero.eyebrow", group: "Header", label: "Small label above the title", type: "text", section: "hero", field: "eyebrow" },
        { key: "hero.title", group: "Header", label: "Title", type: "text", section: "hero", field: "title" },
        { key: "hero.subtitle", group: "Header", label: "Subtitle", type: "textarea", rows: 2, section: "hero", field: "subtitle" },
        { key: "about.title", group: "Our tradition", label: "Heading", type: "text", section: "about", field: "title" },
        { key: "about.body", group: "Our tradition", label: "Body", type: "textarea", rows: 5, section: "about", field: "body", hint: "Shown on the home page and at the top of /about." },
        { key: "footer.body", group: "Footer", label: "Main line", type: "text", section: "footer", field: "body", hint: "Appears on every page." },
        { key: "footer.note", group: "Footer", label: "Second line", type: "text", section: "footer", field: "note" },
      ],
    },
    {
      path: "visiting",
      title: "Visiting",
      slots: [
        { key: "visiting.title", group: "Visiting", label: "Heading", type: "text", section: "visiting", field: "title" },
        { key: "visiting.address", group: "Visiting", label: "Address", type: "text", section: "visiting", field: "address" },
        { key: "visiting.body", group: "Visiting", label: "Body", type: "textarea", rows: 4, section: "visiting", field: "body", hint: "Address and what a first-time visitor needs to know." },
        { key: "visiting.notes", group: "Visiting", label: "Smaller note underneath", type: "textarea", rows: 2, section: "visiting", field: "notes" },
      ],
    },
    {
      path: "resources",
      title: "Resources",
      slots: [
        { key: "resources.title", group: "Resources", label: "Heading", type: "text", section: "resources", field: "title" },
        { key: "resources.body", group: "Resources", label: "Body", type: "textarea", rows: 4, section: "resources", field: "body", hint: "Intro text above the texts and sheets." },
      ],
    },
  ],
};

export const hubSite: HubSite = {
  orgId: siteConfig.orgId,
  name: siteConfig.orgName,
  mark: "PT",
  domain: siteConfig.domain,
  baseUrl: `https://${siteConfig.domain}`,
  basePath: "",
  timeZone: process.env.SITE_TIME_ZONE ?? "America/Toronto",
  features: {},
  siteBuilder,
};

/** The signed-in person as the cards see them; null when signed out. */
export async function getHubCardViewer(): Promise<HubViewer | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  const [row] = await db<Array<{ display_name: string | null; is_admin: boolean | null }>>`
    SELECT display_name, is_admin FROM users WHERE id = ${viewer.userId} LIMIT 1
  `;
  return {
    userId: viewer.userId,
    name: row?.display_name || viewer.email,
    role: viewer.role,
    isNetworkAdmin: Boolean(row?.is_admin),
  };
}

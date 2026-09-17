/**
 * Render a dossier to a standalone HTML file.
 *
 * Why this exists: the template has sections that only appear once a person
 * has BOTH the content and the section switched on, and there is no headless
 * browser on this box. Without a way to render the whole file from real data,
 * the new sections could only be checked by mutating someone's live profile
 * flags — which is a change to what their public page shows, to look at a
 * layout.
 *
 * So this reads a real profile, forces every optional section on IN MEMORY
 * ONLY, inlines the template CSS and writes a file you can open. Nothing is
 * written to the database.
 *
 *   docker exec eac-artdirect sh -c \
 *     "cd /app/apps/artdirect && npx tsx scripts/preview-dossier.mts jg /tmp/out.html"
 */
import fs from "node:fs";
import { renderDossierFromDisk, readTemplateCss } from "@elkdonis/cms-bindings/node";
import { DOSSIER_TEMPLATE_ID } from "@elkdonis/cms-bindings/dossier";
import { getFullDossier } from "../src/lib/oad.js";

function templateCss(): string {
  return `${readTemplateCss(DOSSIER_TEMPLATE_ID)}
html, body { margin: 0; background: var(--eac-dos-bg-desk); }`;
}

const slug = process.argv[2] ?? "jg";
const out = process.argv[3] ?? "/tmp/dossier-preview.html";
/**
 * Fill the sections this person happens to have nothing in, so the whole
 * design can be looked at in one pass. Off by default: a preview of real data
 * that quietly invents some is worse than no preview.
 */
const demo = process.argv.includes("--demo");

const profile = await getFullDossier(slug, {});
if (!profile) {
  console.error(`No profile for slug "${slug}".`);
  process.exit(1);
}

// In memory only. The point of the preview is to see a full file; the point of
// the flags is that a person chooses. Both hold, because this never saves.
const forced = {
  ...profile,
  sections: {
    dispatches: true,
    movements: true,
    galleries: true,
    store: true,
    workHistory: true,
  },
};

if (demo) {
  const day = 864e5;
  if (forced.work_history.length === 0) {
    forced.work_history = [
      {
        role: "Artist in residence",
        organisation: "Lakeside Print Co-operative, Toronto",
        from: "2023",
        to: "Present",
        detail: "Two winters in the cold room. Nine editions pulled.",
      },
      {
        role: "Selected, Biennial of Works on Paper",
        organisation: "Art Gallery of Hamilton",
        from: "2021",
        detail: null,
      },
      {
        role: "Instructor, intaglio",
        organisation: "Open Studio",
        from: "2018",
        to: "2021",
        detail: null,
      },
    ];
  }
  if (!forced.storefront) {
    forced.storefront = {
      name: "Norton Street Editions",
      href: "#",
      lots: [
        { id: "l1", title: "Night Tunnel, ed. 3/12", href: "#", imageUrl: forced.operations[0]?.image_url ?? null, price: "$420.00", status: "available" },
        { id: "l2", title: "High Water", href: "#", imageUrl: forced.operations[1]?.image_url ?? null, price: "$1,250.00", status: "available" },
        { id: "l3", title: "The Cedar Bar (study)", href: "#", imageUrl: forced.operations[2]?.image_url ?? null, price: null, status: "sold" },
      ],
    };
  }
  if (forced.channels.length === 0) {
    forced.channels = [
      { title: "Website", url: "https://example.com" },
      { title: "Instagram", url: "https://instagram.com/subject" },
    ];
  }
  if (forced.financial_channels.length === 0) {
    forced.financial_channels = [
      { title: "Patreon", description: "Monthly dispatches for subscribers", url: "https://patreon.com/subject" },
    ];
  }
  if (forced.current_targets.length === 0) {
    forced.current_targets = [
      "A darkroom process for infrared film.",
      "Documenting the demolition of the old industrial sector.",
    ];
  }
  if (forced.projected_movements.length === 0) {
    forced.projected_movements = ["A hardcover photobook, next winter."];
  }
  if (forced.verified_contacts.length === 0) {
    forced.verified_contacts = ["Nightowl Crew", "Leica Society"];
  }
  if (forced.wanted_accomplices.length === 0) {
    forced.wanted_accomplices = ["Bookbinders", "Independent publishers"];
  }
  if (forced.movements.length === 0) {
    forced.movements = [
      { id: "m1", title: "Warehouse pop-up, opening night", href: "#", scheduledAt: new Date(Date.now() + 12 * day).toISOString(), durationMinutes: 180, location: "Toronto", orgName: "Elkdonis Arts Collective", kind: "event" },
      { id: "m2", title: "Intaglio intensive, weekend one", href: "#", scheduledAt: new Date(Date.now() - 40 * day).toISOString(), durationMinutes: 480, location: "Open Studio", orgName: "IFAC", kind: "workshop" },
    ];
  }
  if (forced.dispatches.length === 0) {
    forced.dispatches = [
      { id: "d1", title: "On painting the hours a city is least watched", href: "#", excerpt: "The studio empties at seven and the light stops behaving. Notes from four winters of working after everyone has gone home.", coverImageUrl: forced.operations[0]?.image_url ?? null, publishedAt: new Date(Date.now() - 9 * day).toISOString(), orgName: "Elkdonis Arts Collective", kind: "post" },
      { id: "d2", title: "Notes on infrared film", href: "#", excerpt: "A darkroom process worked out over one winter, and the three things that go wrong.", publishedAt: new Date(Date.now() - 62 * day).toISOString(), orgName: "IFAC", kind: "writing" },
      { id: "d3", title: "What a jazz rehearsal taught me about underpainting", href: "#", excerpt: null, publishedAt: new Date(Date.now() - 140 * day).toISOString(), orgName: "Elkdonis Arts Collective", kind: "post" },
      { id: "d4", title: "Against the finished surface", href: "#", excerpt: null, publishedAt: new Date(Date.now() - 300 * day).toISOString(), orgName: "IFAC", kind: "post", draft: true },
    ];
  }
  if (forced.exhibits.length === 0) {
    forced.exhibits = [
      { id: "g1", title: "Tunnels", href: "#", description: null, coverUrl: forced.operations[3]?.image_url ?? null, itemCount: 18 },
      { id: "g2", title: "Jazz portraits, 1998—2006", href: "#", description: null, coverUrl: forced.operations[4]?.image_url ?? null, itemCount: 41 },
      { id: "g3", title: "Works on paper", href: "#", description: null, coverUrl: null, itemCount: 7 },
    ];
  }
  if (forced.activity && forced.activity.filingCount === 0) {
    forced.activity = {
      ...forced.activity,
      filingCount: 4,
      mediaCount: 112,
      orgs: forced.activity.orgs.map((o, i) =>
        i === 0
          ? {
              ...o,
              filings: [
                { id: "f1", title: "On painting the hours a city is least watched", href: "#", date: new Date(Date.now() - 9 * day).toISOString() },
                { id: "f2", title: "Notes on infrared film", href: "#", date: new Date(Date.now() - 62 * day).toISOString() },
                { id: "f3", title: "Against the finished surface", href: "#", date: null, draft: true },
              ],
            }
          : o
      ),
    };
  }
  if (forced.occupation == null) forced.occupation = "Painter, jazz musician";
  if (forced.location == null) forced.location = "Grass Valley, CA";
}

/**
 * Inline every image as a data URI.
 *
 * Media on this network is served through each app's own /api/media proxy, so
 * the src attributes in the rendered HTML are site-relative. A file opened
 * from disk, or a preview rendered somewhere other than the app's own origin,
 * resolves those against the wrong host and shows a page of broken frames —
 * which for a design whose whole subject is photographs is no preview at all.
 */
async function inlineImages(markup: string, origin: string): Promise<string> {
  const srcs = [...new Set([...markup.matchAll(/src="([^"]+)"/g)].map((m) => m[1]))];
  let out = markup;
  for (const src of srcs) {
    if (src.startsWith("data:")) continue;
    const url = src.startsWith("http") ? src : `${origin}${src}`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const type = res.headers.get("content-type") ?? "image/jpeg";
      const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
      out = out.split(`src="${src}"`).join(`src="data:${type};base64,${b64}"`);
    } catch {
      // A picture that will not fetch costs that picture, not the preview.
    }
  }
  return out;
}

const inline = process.argv.includes("--inline-images");
const origin = process.env.PREVIEW_ORIGIN ?? "http://localhost:3013";

let bodyHtml = renderDossierFromDisk(forced, { archiveName: "ArtDirect", indexHref: "#" });
if (inline) bodyHtml = await inlineImages(bodyHtml, origin);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${forced.name} — dossier preview</title>
<style>
${templateCss()}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

fs.writeFileSync(out, html);
console.log(
  `Wrote ${out} — ${forced.name}: ` +
    [
      `${forced.operations.length} works`,
      `${forced.dispatches.length} dispatches`,
      `${forced.movements.length} movements`,
      `${forced.exhibits.length} exhibits`,
      `${forced.storefront?.lots.length ?? 0} lots`,
      `${forced.work_history.length} record lines`,
      `${forced.channels.length} addresses`,
      `${forced.financial_channels.length} money links`,
      `${forced.activity?.orgs.length ?? 0} orgs`,
    ].join(", ")
);

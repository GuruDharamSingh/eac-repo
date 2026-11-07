// Run: docker exec eac-elktours sh -c "cd /app/apps/elktours && node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/import-films-2026-11-01.mts /tmp/elktours-films"
// One-off (2026-11-01): put the tours filmed in ElkTourUnity on the site.
// For each film folder <threadId>-{1080,720}.mp4 + -poster.jpg: upload to the org's Media/Videos and Media/Images,
// set threads.metadata.film (+ coverImageUrl when the tour has none) and publish. The six itinerary tours that were
// never in the database are created from <id>-stops.json + <id>-tour.json (the walking route the film was made from).
import { readFileSync, existsSync } from "node:fs";
import { db } from "@elkdonis/db";
import { createOrgFolders, ensureUniqueThreadSlug, getProxyFileUrl, uploadFile } from "@elkdonis/services";
import { saveTourStops } from "@elkdonis/commerce/server";
const { slugifyTitle } = await import("../src/lib/cms/schema");
const { ensureStopStills } = await import("../src/lib/tour-cache");

const ORG = "elktours";
const DIR = process.argv[2] ?? "/tmp/elktours-films";

interface Copy { excerpt: string; body: string; highlights: string[] }

/** Intros for the tours that arrived as itineraries only (2026-11-01, Claude; Dana to revise in place). */
const NEW: Record<string, Copy> = {
  elkIleCite1tour000001: {
    excerpt: "Nine stops on the island where Paris began: Notre-Dame, the Sainte-Chapelle, the Conciergerie, Place Dauphine, then over the Pont des Arts to the Louvre.",
    body: "<p>The Parisii lived on this island before the Romans came, and for most of the Middle Ages it held both the cathedral and the royal palace. We start at Notre-Dame, pass the Hôtel-Dieu, the city’s oldest hospital, and go into the palace quarter: the Sainte-Chapelle, built by Louis IX for the relics he bought, and the Conciergerie, where the Revolution kept its prisoners.</p><p>Then the quiet end of the island: Place Dauphine, the Square du Vert-Galant at its tip, the bouquinistes’ green boxes along the quays, and the Pont des Arts across to the Louvre.</p>",
    highlights: ["Notre-Dame and the Hôtel-Dieu", "The Sainte-Chapelle and the Conciergerie", "Place Dauphine and the Square du Vert-Galant", "Over the Pont des Arts to the Louvre"],
  },
  elkLegends1tour000010: {
    excerpt: "Seven places where Paris keeps its saints, alchemists and stone symbols, from the portals of Notre-Dame to the house Nicolas Flamel built in 1407.",
    body: "<p>Paris keeps its legends in stone. The west front of Notre-Dame is a carved book of saints, virtues and vices; the Sainte-Chapelle was built for relics that cost the king more than the chapel did. Across the Pont au Change, the Tour Saint-Jacques is all that is left of the church where pilgrims set out for Compostela.</p><p>North of the river we follow Nicolas Flamel, a fourteenth-century scrivener remembered later as an alchemist, to the house he built in 1407. We finish with the Grande Caryatide on rue de Turbigo and the Square du Temple, where the Knights Templar had their fortress.</p>",
    highlights: ["The carved portals of Notre-Dame", "The Sainte-Chapelle and its relics", "Tour Saint-Jacques, where pilgrims set out", "Nicolas Flamel’s house of 1407", "The Grande Caryatide and the Templars’ square"],
  },
  elkLatinQu1tour000003: {
    excerpt: "Seventeen stops from Place Saint-Michel to rue Mouffetard: Roman baths, medieval churches, the Sorbonne, the Panthéon and a cellar that has played jazz since the 1940s.",
    body: "<p>The Latin Quarter is named for the language its students spoke until the Revolution. We start at Place Saint-Michel, take in Saint-Germain and Shakespeare and Company, and go down rue de la Huchette to the Caveau, a medieval cellar turned jazz club. Saint-Séverin and rue Saint-Jacques, the old Roman road south, lead to the baths of Lutèce and the Musée de Cluny.</p><p>Then up the hill: the Sorbonne, the Collège de France, the Panthéon with Saint-Étienne-du-Mont beside it, Place de la Contrescarpe and rue Mouffetard, one of the oldest market streets in the city.</p>",
    highlights: ["Shakespeare and Company and rue de la Huchette", "The Roman baths and the Musée de Cluny", "The Sorbonne and the Panthéon", "Place de la Contrescarpe and rue Mouffetard"],
  },
  elkMarais01tour000004: {
    excerpt: "Seventeen stops through the Marais: Place des Vosges, the great town houses, the synagogues of the Pletzl, medieval houses, Philippe Auguste’s wall and the Marché des Enfants Rouges.",
    body: "<p>Henri IV laid out Place des Vosges as the Place Royale, and the nobility built around it: Victor Hugo lived at No. 6, and the Hôtel de Sully opens onto the square through its garden. From there we go west past Saint-Paul-Saint-Louis to the Pletzl, the Jewish quarter around rue des Rosiers, and Guimard’s synagogue on rue Pavée.</p><p>The older Marais shows through in places: the timber-framed houses on rue François Miron, a stretch of the wall Philippe Auguste built around 1200, the cloister of the Billettes. We end with the Musée Carnavalet, the Archives in the Hôtel de Soubise, the Marché des Enfants Rouges and Nicolas Flamel’s house.</p>",
    highlights: ["Place des Vosges and Victor Hugo’s house", "The Pletzl: rue des Rosiers and rue Pavée", "Medieval houses and Philippe Auguste’s wall", "Carnavalet, the Archives and the Enfants Rouges market"],
  },
  elkMontmar1tour000008: {
    excerpt: "Eleven stops from the village side of the hill to the Moulin Rouge: the Lapin Agile, the vineyard, the Maison Rose, Sacré-Cœur, Place du Tertre and Abbesses.",
    body: "<p>Montmartre was a village of vineyards and windmills outside the city until 1860. We climb from Lamarck–Caulaincourt on its quiet north side, past the Lapin Agile, where Picasso and his friends drank, the Clos Montmartre vineyard and the Maison Rose on rue de l’Abreuvoir, to the Musée de Montmartre in the house where Renoir had a studio.</p><p>At the top, Sacré-Cœur, the view and the painters of Place du Tertre. Then down past the Moulin de la Galette, which Renoir painted, to Place des Abbesses and the Moulin Rouge at the foot of the hill.</p>",
    highlights: ["The Lapin Agile and the Clos Montmartre vineyard", "The Maison Rose and the Musée de Montmartre", "Sacré-Cœur and Place du Tertre", "Abbesses and the Moulin Rouge"],
  },
  elkFoodMon1tour000009: {
    excerpt: "Five stops on rue Montorgueil: a wine merchant, a cheesemonger, a butcher and Stohrer, the oldest pâtisserie in Paris.",
    body: "<p>Rue Montorgueil fed this neighbourhood for centuries while Les Halles, the city’s central market, stood next door. We walk it from the top: nysa, the wine merchant at No. 94, La Fermette’s cheese counter at No. 86, Boucherie Tribolet at No. 54, and Stohrer at No. 51, opened in 1730 by Nicolas Stohrer, pastry cook to Queen Marie Leszczyńska.</p>",
    highlights: ["nysa cavistes, No. 94", "La Fermette, No. 86", "Boucherie Tribolet, No. 54", "Stohrer, No. 51, since 1730"],
  },
};

/** Tours already in the database that have a film. */
const EXISTING = ["elkFRrev001tour000001", "elkNapol001tour000003"];

const stamp = Date.now().toString(36);

async function put(local: string, remote: string, type: string): Promise<string> {
  const ok = await uploadFile(remote, readFileSync(local), type);
  if (!ok) throw new Error(`upload failed: ${remote}`);
  return getProxyFileUrl(remote);
}

await createOrgFolders(ORG);
const [{ author_id: author }] = (await db`SELECT author_id FROM threads WHERE id = 'elkFRrev001tour000001'`) as unknown as { author_id: string }[];

for (const id of [...Object.keys(NEW), ...EXISTING]) {
  const f = (s: string) => `${DIR}/${id}-${s}`;
  if (!existsSync(f("720.mp4"))) { console.log(id, "no film, skipped"); continue; }
  const film = {
    url: await put(f("1080.mp4"), `EAC_Network/${ORG}/Media/Videos/tour-${id}-1080-${stamp}.mp4`, "video/mp4"),
    url720: await put(f("720.mp4"), `EAC_Network/${ORG}/Media/Videos/tour-${id}-720-${stamp}.mp4`, "video/mp4"),
    poster: await put(f("poster.jpg"), `EAC_Network/${ORG}/Media/Images/tour-${id}-poster-${stamp}.jpg`, "image/jpeg"),
    seconds: 30,
    source: "elktour-unity",
  };

  const copy = NEW[id];
  const [row] = (await db`SELECT id, metadata FROM threads WHERE id = ${id} AND org_id = ${ORG}`) as unknown as { id: string; metadata: Record<string, unknown> | null }[];
  if (!row && copy) {
    const itinerary = JSON.parse(readFileSync(f("stops.json"), "utf8")) as { title: string; meetingPoint: { lat: number; lng: number }; stops: { title: string; lat: number; lng: number }[] };
    const filmed = JSON.parse(readFileSync(f("tour.json"), "utf8")) as { route?: { legs: [number, number][][]; source?: string } };
    const title = itinerary.title.trim();
    const slug = await ensureUniqueThreadSlug(ORG, slugifyTitle(title));
    const metadata = {
      coverImageUrl: film.poster,
      film,
      tour: {
        highlights: copy.highlights, includes: [], languages: [], maxParty: null, effort: null,
        meetingPoint: { lat: itinerary.meetingPoint.lat, lng: itinerary.meetingPoint.lng },
        // The geometry the film flew (FOSSGIS foot router; Food is straight lines by design).
        route: filmed.route?.legs?.length
          ? { legs: filmed.route.legs, fetchedAt: new Date().toISOString(), source: filmed.route.source === "straight" ? "straight" : "osrm" }
          : null,
      },
    };
    await db`
      INSERT INTO threads (id, org_id, author_id, kind, section, title, slug, body, excerpt, status, visibility, metadata, currency, format, published_at)
      VALUES (${id}, ${ORG}, ${author}, 'tour', 'tours', ${title}, ${slug}, ${copy.body}, ${copy.excerpt}, 'published', 'PUBLIC', ${db.json(metadata)}, 'EUR', 'in_person', NOW())
    `;
    await saveTourStops(ORG, id, itinerary.stops.map((s) => ({ title: s.title.trim(), lat: s.lat, lng: s.lng })));
    console.log(id, "created", slug, itinerary.stops.length, "stops");
  } else if (row) {
    const patch: Record<string, unknown> = { film };
    if (!row.metadata?.coverImageUrl) patch.coverImageUrl = film.poster;
    await db`
      UPDATE threads SET metadata = COALESCE(metadata, '{}'::jsonb) || ${db.json(patch)},
        status = 'published', published_at = COALESCE(published_at, NOW()), updated_at = NOW()
      WHERE id = ${id} AND org_id = ${ORG} AND kind = 'tour'
    `;
    console.log(id, "film attached, published");
  }
  console.log("  stills:", JSON.stringify(await ensureStopStills(id)));
}

// The placeholder tour is replaced by the filmed Montmartre walk (brief: archive it before launch).
await db`UPDATE threads SET status = 'archived', updated_at = NOW() WHERE id = 'mzyc19DNtQCRsvTa7r3w' AND org_id = ${ORG}`;
console.log("sample tour archived");
await db.end();

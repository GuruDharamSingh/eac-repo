// Server only (reads the database through lib); imported by /studio server pages.
import type { ExperiencePageData } from "@/blocks/experience/context";
import type { ExperienceView } from "@/components/experiences/types";
import { toExperienceView } from "@/components/experiences/view";
import { listAssets } from "@/lib/assets";
import type { Experience } from "@/lib/catalogue-types";
import { listExperiences } from "@/lib/experiences";

/** Drawn when no experience exists yet, so the layout can still be arranged. Clearly sample words. */
const PLACEHOLDER: ExperienceView = {
  id: "sample",
  slug: "sample",
  title: "A studio visit (sample)",
  excerpt: "Sample text: the experience's own words appear here once one is written in Manage.",
  body: "<p>Sample text. Each experience brings its own description, pictures and people; the layout only decides where they go.</p>",
  status: "draft",
  coverImageUrl: null,
  images: [],
  location: "Paris",
  isOnline: false,
  format: "in_person",
  durationMinutes: 90,
  price: null,
  currency: "EUR",
  highlights: ["Sample highlight", "Another highlight"],
  people: [],
};

/**
 * The experience the layout editor draws over: `focus` when given, else the
 * first published one, else any, else a placeholder. Public fields only
 * (toExperienceView), the same as the public page.
 */
export async function experienceSample(focus?: Experience): Promise<{ data: ExperiencePageData; label: string }> {
  const all = await listExperiences({ includeDrafts: true });
  const pick = focus ?? all.find((e) => e.status === "published") ?? all[0] ?? null;
  const experience = pick ? toExperienceView(pick, await listAssets({ threadId: pick.id })) : PLACEHOLDER;
  const others = all
    .filter((o) => o.id !== pick?.id && o.status === "published")
    .slice(0, 6)
    .map((o) => toExperienceView(o));
  return {
    data: { experience, canEdit: false, signedInEmail: null, others },
    label: pick ? `Shown over: ${pick.title}` : "Shown over sample text (no experiences yet)",
  };
}

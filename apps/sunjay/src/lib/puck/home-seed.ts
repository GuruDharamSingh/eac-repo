import { getImageSpaces, listGalleryImages, listWritingShelf, mediaSrc } from "@/lib/landing";
import { getSiteSections } from "@/lib/data";
import { siteConfig } from "@/config/site";
import type { HomeSeed } from "./home-template";

/**
 * What the home template copies in when it is applied: the owner's current
 * words (org_site_sections) and photograph (site_config image_spaces), and
 * whether the writing shelf and gallery have anything to show.
 */
export async function loadHomeSeed(): Promise<HomeSeed> {
  const [sections, spaces, writing, gallery] = await Promise.all([
    getSiteSections(),
    getImageSpaces(),
    listWritingShelf(1),
    listGalleryImages(1),
  ]);
  const hero = sections.hero ?? {};
  return {
    hero: {
      title: hero.title,
      subtitle: hero.subtitle,
      body: hero.body,
      ctaLabel: hero.cta_label,
      ctaHref: hero.cta_href,
    },
    heroImage: { url: mediaSrc(spaces.hero?.path), alt: spaces.hero?.alt ?? "" },
    materials: sections.materials ?? {},
    about: sections.about ?? {},
    orgName: siteConfig.orgName,
    tagline: siteConfig.tagline,
    guideShortName: siteConfig.guideShortName,
    hasWriting: writing.length > 0,
    hasGallery: gallery.length > 0,
  };
}

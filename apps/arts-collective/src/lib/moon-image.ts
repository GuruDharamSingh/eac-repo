/**
 * The lunar photograph behind the moon-phase pen.
 *
 * One master in the network's own storage, served through this app's media
 * proxy, which hands @elkdonis/services the `?w=` and gets a downscaled
 * variant back. The original is a 5000px, 11MB mosaic and is never sent to a
 * browser: the newsroom column takes 512px (~52KB) and the expanded view
 * takes 1024px (~222KB). It stays on standby in storage for anything that
 * later wants it larger.
 *
 * A mosaic rather than a photograph of a full moon on purpose — it is lit
 * flat right across the disc, with no terminator of its own, which is what a
 * pen that draws its OWN shadow needs.
 */

/** The master, in the collective's org storage. */
export const MOON_IMAGE = "/api/media/EAC_Network/elkdonis/Images/site/moon-nearside-lro-5000.jpg";

/** A CSS `url()` for one of the offered widths (128 · 256 · 512 · 1024). */
export function moonFace(width: 128 | 256 | 512 | 1024): string {
  return `url(${MOON_IMAGE}?w=${width})`;
}

/** Public domain, but the people who made it are still named. */
export const MOON_CREDIT = {
  title: "Nearside mosaic, Lunar Reconnaissance Orbiter",
  author: "NASA / GSFC / Arizona State University",
  license: "Public domain",
  source: "https://commons.wikimedia.org/wiki/File:Moon_nearside_LRO_5000.jpg",
} as const;

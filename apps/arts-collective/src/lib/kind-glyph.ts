/**
 * The mark a kind wears, matching the compose catalogue and the surface
 * mastheads — so the glyph someone picked when making a thing is the glyph
 * they see wherever it is listed.
 *
 * A local copy of the glyph half of `kindMeta` in @elkdonis/cms-ui/surface,
 * which is a client module: importing it into a server component pulls the
 * whole surface runtime across the boundary for one character.
 */
const GLYPHS: Record<string, string> = {
  post: "◉",
  writing: "◉",
  event: "◆",
  meeting: "◎",
  workshop: "◈",
  service: "◇",
  product: "▣",
  questionnaire: "▤",
  poll: "▥",
  idea: "✦",
  document: "▭",
  wiki_page: "§",
};

export function kindGlyph(kind: string | null | undefined): string {
  return GLYPHS[kind ?? ""] ?? "•";
}

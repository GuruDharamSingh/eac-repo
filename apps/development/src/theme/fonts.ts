// Fonts for the Development app: the platform's real families, loaded once for the whole app so tiles,
// mocks and the sandbox draw in the faces the apps use instead of falling back to Georgia.
//
//  - Google families: one stylesheet <link> built by @elkdonis/fonts (googleFontsHref), rendered in the root
//    layout. Only families in the shared library are included (the helper skips unknown ones).
//  - Local faces: Basteleur (SIL Open Font License), Brothers and Venture (commercial licences held by Justin, confirmed
//    2026-11-21) ship with this app under ./fonts, copied from apps/elktours/public/fonts, and are declared in
//    ./test-theme.css.
//
// The relative import reaches packages/fonts directly (pure data, no dependencies) so no workspace link is needed.
import { googleFontsHref } from "../../../../packages/fonts/src/google";

/** Every Google family the apps' themes name (themes.json fonts), plus the test theme's own roles. */
export const GOOGLE_FAMILIES = [
  // the test theme's roles
  "Inter",
  "Fraunces",
  "Newsreader",
  "JetBrains Mono",
  // used by the apps' themes
  "Cormorant Garamond",
  "EB Garamond",
  "Spectral",
  "Karla",
  "Marcellus",
  "Chivo Mono",
  "Jost",
  "Cinzel",
  "Lora",
  "Merriweather",
  "Source Serif 4",
  "Space Grotesk",
  "Share Tech Mono",
  "Courier Prime",
  "UnifrakturCook",
] as const;

/** The stylesheet URL for all of them, or null if none resolves. */
export function fontsHref(): string | null {
  return googleFontsHref(GOOGLE_FAMILIES, { weights: [400, 500, 600, 700] });
}

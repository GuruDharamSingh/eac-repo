import { Chivo_Mono, Cormorant_Garamond, EB_Garamond, Marcellus, Spectral } from "next/font/google";

/**
 * The house type.
 *
 * Round 3 (2026-11-07): Ario's original Silex faces are the default again
 * (packages/silex-nextcloud-connector/src/templates/enneagram/tokens):
 *   Cormorant Garamond  display: titles, the large quiet headings
 *   EB Garamond         reading, and the letter-spaced small-capital labels
 *
 * The ÆON draft's three (round 1) stay loaded for the "ÆON" look preset
 * (Site style → Look), without preloading:
 *   Marcellus · Spectral · Chivo Mono
 *
 * Declared here rather than in layout.tsx so the page editor can put the same
 * variable classes on its canvas (sunjay's pattern): Puck draws the page in an
 * iframe whose <html> does not carry the classes the root layout sets.
 */
export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

export const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-eb-garamond",
  display: "swap",
});

export const marcellus = Marcellus({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-marcellus",
  display: "swap",
  preload: false,
});

export const spectral = Spectral({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
  preload: false,
});

export const chivoMono = Chivo_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-chivo-mono",
  display: "swap",
  preload: false,
});

/** The class string the fonts need on an element for their variables to resolve. */
export const fontVariables = `${cormorant.variable} ${ebGaramond.variable} ${marcellus.variable} ${spectral.variable} ${chivoMono.variable}`;

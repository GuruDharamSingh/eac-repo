import { Chivo_Mono, Marcellus, Spectral } from "next/font/google";

/**
 * The ÆON draft's three faces (Ario's own design, 2026-10-29), now the house
 * type of The Hidden Enneagram:
 *   Marcellus   display: inscriptional capitals for titles and the figure's numbers
 *   Spectral    reading: a light screen serif for long passages
 *   Chivo Mono  labels: eyebrows, step counts, legends
 *
 * Declared here rather than in layout.tsx so the page editor can put the same
 * variable classes on its canvas (sunjay's pattern): Puck draws the page in an
 * iframe whose <html> does not carry the classes the root layout sets.
 */
export const marcellus = Marcellus({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-marcellus",
  display: "swap",
});

export const spectral = Spectral({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
});

export const chivoMono = Chivo_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-chivo-mono",
  display: "swap",
});

/** The class string the three fonts need on an element for their variables to resolve. */
export const fontVariables = `${marcellus.variable} ${spectral.variable} ${chivoMono.variable}`;

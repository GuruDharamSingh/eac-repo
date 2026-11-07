import { Fraunces, Karla } from "next/font/google";

/**
 * Fraunces for display (a soft serif with real optical sizes and an italic
 * that reads like a potter's hand-lettered label), Karla for reading. Not the
 * auction house's Cormorant + Jost: Collect Art is the market, this is her
 * own shop.
 *
 * Declared here rather than in layout.tsx so the page editor can put the same
 * variable classes on its canvas (sunjay's pattern): Puck draws the page in an
 * iframe whose <html> does not carry the classes the root layout sets.
 */
export const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

export const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-karla",
  display: "swap",
});

/** The class string both fonts need on an element for their variables to resolve. */
export const fontVariables = `${fraunces.variable} ${karla.variable}`;

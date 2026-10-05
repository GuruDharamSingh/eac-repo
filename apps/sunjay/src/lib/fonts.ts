import { Fraunces, Spectral } from "next/font/google";

/**
 * Fraunces for display, Spectral for reading — a soft-serif with real weight
 * over a text serif built for long passages. Deliberately not amrit-canada's
 * Cinzel/Lora: the two sites share a codebase, not a voice.
 *
 * Declared here rather than in layout.tsx so the page editor can put the same
 * two variable classes on its canvas: Puck draws the page in an iframe whose
 * <html> element does not carry the classes the root layout sets.
 */
export const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

export const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
});

/** The class string both fonts need on an element for their variables to resolve. */
export const fontVariables = `${fraunces.variable} ${spectral.variable}`;

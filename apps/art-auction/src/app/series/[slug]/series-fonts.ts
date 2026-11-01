import { Cormorant_Garamond, Jost } from "next/font/google";

/** The series template's type pair; loaded by the series page and the workspace's preview. */
export const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"], variable: "--font-cormorant", display: "swap" });
export const jost = Jost({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-jost", display: "swap" });

import { FAMILIES } from "../../../classifieds/families";
import { EXTRA_FONTS } from "@/classifieds/templates";

/**
 * One Google Fonts stylesheet for every family the catalog names. Loaded by
 * the classifieds routes only; the rest of ArtDirect keeps its own two faces.
 */
const WEIGHTS: Record<string, string> = {
  "Libre Caslon Text": "ital,wght@0,400;0,700;1,400;1,700",
  "Old Standard TT": "ital,wght@0,400;0,700;1,400",
  "Source Serif 4": "opsz,wght@8..60,400;8..60,700",
  "League Spartan": "wght@500;800;900",
  "Roboto Condensed": "wght@400;700",
  Arimo: "ital,wght@0,400;0,700;1,400",
  Tinos: "ital,wght@0,400;0,700;1,400",
  Oswald: "wght@400;500;700",
  "Courier Prime": "wght@400;700",
  "Playfair Display": "ital,wght@0,400;0,900;1,400",
};

export function ClassifiedsFonts() {
  const names = Array.from(new Set([...FAMILIES.flatMap((f) => f.fonts), ...EXTRA_FONTS].filter((n) => !n.startsWith("Noto "))));
  const params = names.map((n) => `family=${n.replace(/ /g, "+")}${WEIGHTS[n] ? `:${WEIGHTS[n]}` : ""}`).join("&");
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${params}&display=swap`} />
    </>
  );
}

import { cn } from "./utils";
import type { Element } from "@elkdonis/astro";

/**
 * An astrological symbol, forced to text presentation. The zodiac code points
 * (♈–♓) default to emoji on most platforms; U+FE0E asks for the plain glyph.
 */
export function Glyph({ children, className, label }: { children: string; className?: string; label?: string }) {
  return (
    <span className={cn("eac-sky-glyph", className)} aria-label={label} aria-hidden={label ? undefined : true} role={label ? "img" : undefined}>
      {children}
      {"\uFE0E"}
    </span>
  );
}

export const ELEMENT_TEXT: Record<Element, string> = {
  fire: "text-fire",
  earth: "text-earth",
  air: "text-air",
  water: "text-water",
};

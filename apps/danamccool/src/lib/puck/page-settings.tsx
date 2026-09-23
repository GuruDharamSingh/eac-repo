import type { CSSProperties, ReactNode } from "react";
import type { PropDef } from "@elkdonis/blocks";
import { FONTS, googleFontsHref, pageFontStyle } from "@/lib/fonts";

// ============================================================================
// A page's own settings, beside "Page title" in the editor's Page panel
// (click the canvas background). Used by both the editor and published pages.
//
// Fonts: a page may use its own body and heading faces. Empty = the site's,
// set in /studio/theme. The sidebar menu is the site's and is not affected.
// ============================================================================

const fontOptions = (siteLabel: string) => [
  { value: "", label: siteLabel },
  ...FONTS.map((f) => ({ value: f.id, label: f.label })),
];

export const PAGE_SETTINGS: PropDef[] = [
  {
    name: "fontBody",
    kind: "select",
    label: "Body font (this page)",
    description: "Leave on the site's to follow the theme.",
    default: "",
    options: fontOptions("The site's body font"),
  },
  {
    name: "fontHeading",
    kind: "select",
    label: "Heading font (this page)",
    default: "",
    options: fontOptions("The site's heading font"),
  },
];

/** Wraps the page's content in its own fonts, when it has any. */
export function PageSettingsWrap({ settings, children }: { settings: Record<string, unknown>; children?: ReactNode }) {
  const f = {
    body: typeof settings.fontBody === "string" ? settings.fontBody : undefined,
    heading: typeof settings.fontHeading === "string" ? settings.fontHeading : undefined,
  };
  const style = pageFontStyle(f);
  if (!style) return <>{children}</>;
  const href = googleFontsHref([f.body, f.heading]);
  return (
    <div className="dm-page-fonts" style={style as CSSProperties}>
      {/* React 19 hoists a stylesheet <link> with `precedence` into <head> —
          on the published page and inside the editor's canvas alike. */}
      {href ? <link rel="stylesheet" href={href} precedence="default" /> : null}
      {children}
    </div>
  );
}

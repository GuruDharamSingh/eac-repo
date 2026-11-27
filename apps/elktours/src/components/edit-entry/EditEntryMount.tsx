"use client";

import { EditEntry, provideSiteStyle } from "@elkdonis/house-editor/entry";
import type { SiteStyle } from "@elkdonis/direct-edit/site";
import { SITE_STYLE } from "@/lib/site-style-schema";
import { saveSiteStyleAction } from "@/lib/site-style-actions";

/** The one Edit button on this site's pages. The layout sends it only to owners and guides; every save checks again. */
const HIDDEN_ON = ["/studio", "/manage", "/hub", "/account", "/login"];

/** A page made in the page builder shows its own "Edit this page" link to its studio; the button offers that same way. */
function studioLink(): string | null {
  const a = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/studio/"]')).find((l) => /edit this page/i.test(l.textContent ?? ""));
  return a?.getAttribute("href") ?? null;
}

export function EditEntryMount({ initial }: { initial: SiteStyle | null }) {
  provideSiteStyle({ schema: SITE_STYLE, initial, save: saveSiteStyleAction });
  // Phones have a bottom bar: the button sits above it.
  return <EditEntry hiddenOn={HIDDEN_ON} editPageHref={() => studioLink()} phoneLift={72} />;
}

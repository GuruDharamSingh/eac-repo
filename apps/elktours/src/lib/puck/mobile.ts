import type { Data } from "@puckeditor/core";
import { loadPage } from "./store";
import { MOBILE_DEFAULTS } from "./mobile-defaults";
import { isMobileKey, type MobileKey } from "./mobile-keys";
import { mobileServerConfig } from "./config.mobile.server";

// The phone documents (G2). Keys and the code defaults live in mobile-keys.ts and mobile-defaults.ts (no database);
// this file is the server loader. `puck:m-<name>` is the site_config row.
export { MOBILE_KEYS, MOBILE_PATH, PHONE_WIDTH, isMobileKey, type MobileKey } from "./mobile-keys";
export { MOBILE_DEFAULTS } from "./mobile-defaults";

const KNOWN = new Set(Object.keys(mobileServerConfig.components));

/** The saved phone document, else the code default. Never throws for a missing row. */
export async function loadMobileDoc(key: MobileKey): Promise<{ data: Data; saved: boolean }> {
  if (!isMobileKey(key)) throw new Error(`not a phone document: ${key}`);
  const stored = await loadPage(key, KNOWN).catch(() => null);
  return stored ? { data: stored.data as Data, saved: true } : { data: MOBILE_DEFAULTS[key], saved: false };
}

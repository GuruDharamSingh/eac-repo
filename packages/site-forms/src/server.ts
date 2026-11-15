// Server helpers for a site's thin form actions. No "use server" here: a site's own
// `lib/forms/<kind>-actions.ts` is the server-action file and imports these.
// The org always comes from the site's config; the `orgId` a client sends is checked and otherwise ignored.

export const WRONG_ORG = "This form is for this site only.";

/** The site's org when the caller names it (or names none); null when the caller named another org. */
export function siteOrg(siteOrgId: string, requested: string | null | undefined): string | null {
  return !requested || requested === siteOrgId ? siteOrgId : null;
}

export type SiteResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

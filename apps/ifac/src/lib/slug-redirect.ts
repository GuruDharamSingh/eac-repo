import "server-only";
import { permanentRedirect } from "next/navigation";
import { resolveUserSlugRedirect } from "@elkdonis/services";

/**
 * On a profile route's not-found path: if `slug` is a person's old slug
 * (user_slug_redirects), answer 308 to `pathFor(currentSlug)`. Returns
 * normally when it is not, and the caller goes on to notFound().
 */
export async function redirectRenamedProfile(slug: string, pathFor: (current: string) => string): Promise<void> {
  const current = await resolveUserSlugRedirect(slug);
  if (current) permanentRedirect(pathFor(encodeURIComponent(current)));
}

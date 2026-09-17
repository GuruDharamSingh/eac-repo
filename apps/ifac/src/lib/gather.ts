// ============================================================================
// The one host fact the shared gathering code cannot know: where a thread
// lives on THIS site. The viewer's role map moved to @elkdonis/services
// (`gatherViewerFor`) once a second host needed it.
// ============================================================================

/**
 * Where a thread lives on IFAC.
 *
 * Every thread is a forum topic, so the forum's own scheme is the one true
 * answer for all of them; only the wiki is a peer section with a path of its
 * own. Deliberately NOT /hub/meetings/[slug] — that page is members-only, and
 * a gathered row on a public page must not link somewhere that 403s.
 */
export function threadHref(t: { kind: string; slug: string; id: string }): string {
  if (t.kind === "wiki_page") return `/forum/wiki/${t.slug}`;
  return `/forum/t/${t.id}/${t.slug || "topic"}`;
}

/** The wiki page behind a defined term. */
export function termHref(slug: string): string {
  return `/forum/wiki/${slug}`;
}

// ============================================================================
// The one host fact the shared gathering code cannot know: where a thread
// lives on THIS site. Everything else — the viewer's role map, the four
// verbs, the candidate search — is `@elkdonis/services`.
// ============================================================================

/**
 * Where a thread lives on amrit-canada.
 *
 * This site routes content by feed, `/{section}/{slug}`, so a thread with no
 * section has no page here and the row lists without opening. That is the
 * honest answer for a living document (migration 133 gives them no section —
 * they are opened from Nextcloud, and only past a membership check) and for a
 * thread belonging to another org.
 */
export function threadHref(t: {
  orgId: string;
  kind: string;
  slug: string;
  id: string;
  section: string | null;
}): string | null {
  // The wiki is network-wide and org `elkdonis`, reached here as a peer
  // section of the forum rather than through a feed.
  if (t.kind === "wiki_page") return `/forum/wiki/${t.slug}`;
  if (t.orgId !== "amrit_canada") return null;
  return t.section ? `/${t.section}/${t.slug}` : null;
}

/** The wiki page behind a defined term. */
export function termHref(slug: string): string {
  return `/forum/wiki/${slug}`;
}

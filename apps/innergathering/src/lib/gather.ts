// ============================================================================
// The one host fact the shared gathering code cannot know: where a thread
// lives on THIS site. Everything else — the viewer's role map, the four
// verbs, the candidate search — is `@elkdonis/services`.
// ============================================================================

/**
 * Where a thread lives on innergathering.
 *
 * Content routes by feed, `/{section}/{slug}`; a thread with no section has no
 * page here and the row lists without opening. That covers living documents
 * (migration 133 gives them no section on purpose) and threads from other orgs.
 *
 * Definitions return null too, and deliberately: this site serves no forum, so
 * it has no `/forum/wiki` to send anyone to. The term still LISTS — knowing
 * the vocabulary a meeting produced is most of the value — it simply does not
 * link anywhere, which is truer than linking to a 404.
 */
export function threadHref(t: {
  orgId: string;
  kind: string;
  slug: string;
  id: string;
  section: string | null;
}): string | null {
  if (t.kind === "wiki_page") return null;
  if (t.orgId !== "inner_group") return null;
  return t.section ? `/${t.section}/${t.slug}` : null;
}

/** No wiki on this site — see above. */
export function termHref(): string | null {
  return null;
}

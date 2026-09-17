// ============================================================================
// Which thread kinds an org surface is allowed to harvest.
//
// `threads` is one namespace with no CHECK on `kind`, and almost every feed,
// forum and search query filters on `org_id + status + visibility` while
// selecting `kind` as a column it never tests. So a row of a new kind is
// enrolled in every one of those surfaces the moment it exists — a kind is
// opt-OUT, not opt-in, which is the opposite of how it reads.
//
// Three kinds are deliberately not forum topics and not feed items:
//
//   wiki_page  a collectively edited reference surface with no first-post
//              semantics, reached through the wiki (migration 123)
//   writing    a person's own blog, which lives on their profile page and is
//              theirs rather than the org's voice
//   document   the group's living documents (migration 133) — working files in
//              the org's Nextcloud folder, reached from the documents surface
//              and from whatever gathered them. This one is the sharpest of
//              the three: the row carries a public WRITABLE share link, so it
//              must not reach a feed, the forum or search, none of whose
//              predicates were written with that in mind.
//
// None can be hidden by choosing a `visibility`: the forum predicates have
// a global-admin branch that returns everything published and an
// `OR author_id = viewer` clause that ignores visibility entirely, so the
// author of a personal post would see it listed as a forum topic whatever
// value the row carried. An explicit kind exclusion is the only thing that
// holds.
// ============================================================================

/**
 * Kinds that belong to one surface of their own and are excluded from org
 * feeds, the forum, search and the cross-org network feed.
 *
 * Exported as a plain array rather than a SQL fragment so an app outside this
 * package can spell the exclusion in its own query:
 *
 *     AND t.kind <> ALL(${OFF_FEED_KINDS})
 */
export const OFF_FEED_KINDS: string[] = ['wiki_page', 'writing', 'document'];

/** The kind behind a person's own blog. See writing.ts. */
export const WRITING_KIND = 'writing';

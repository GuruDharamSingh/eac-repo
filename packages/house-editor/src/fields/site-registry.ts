// ============================================================================
// Fields lens: what every canvas site declares the same way (lane LIVE, 2026-11-20). Pure data, no imports of a store:
// the client lens reads it for labels and limits, the server (./site.ts) for the allow-list.
//
// A card that shows a post's title because its own was left empty offers `record:thread:<id>:title`; saved through the
// catalogue's `thread-edit` (packages/actions: a post, by its author or the organisation's owners and guides). The
// catalogue has no entry that renames a gathering, a tour or a series (checked 2026-11-20: `thread-edit` is for
// `threads.kind = 'post'` only, `updatePost` filters on it), so a card showing one of those reads "read only" with the
// reason, and nothing writes `threads` by hand. When such an entry exists, change `readOnlyThread` in ./site.ts.
// ============================================================================

import { defineFields } from "./registry";

export const siteFieldsRegistry = defineFields({
  thread: {
    capability: "thread-edit",
    label: "Post",
    shared: "This changes the post itself, everywhere it appears.",
    fields: {
      title: { label: "Title", input: "text", inline: true, max: 200, optional: false },
      excerpt: { label: "Summary", input: "textarea", readOnly: "The summary is made from the post's own text. Change the text on its own page." },
      meta: { label: "Details", input: "text", readOnly: "The date comes from the gathering itself." },
    },
  },
});

// Para Theater's declared fields (Fields lens pilot, 2026-11-20): the page wording kept in org_site_sections.
// Pure data: read by the client lens (labels, kinds, limits) and by the server action (allow-list, validation).
// The slot keys mirror hubSite.siteBuilder.templatePages[""] (lib/hub-site.ts): the canonical save runner
// `site-section-save` refuses any key that is not one of those slots, so this list can only narrow it.
//
// about.title is a slot in the hub card but no page draws it, so it is not declared here.
// Words that live in a Puck document (the home page once it is saved as a tree, any /studio page) are NOT
// declared here and carry no data-field: the canvas is their one writer.

import { defineFields } from "@elkdonis/house-editor/fields/server";

export const fields = defineFields({
  // A post a card shows (live editor, 2026-11-20). Saved through the catalogue's `thread-edit`: title or text of a post,
  // by its author or the organisation's owners and guides, on this site's org only. Gatherings and series are not posts
  // to that entry, so a card showing one reads "read only" with the reason (see app/fields/actions.ts).
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
  section: {
    capability: "site-section-save",
    label: "Page wording",
    records: {
      hero: {
        label: "Banner wording",
        fields: {
          eyebrow: { label: "Small label above the title", input: "text", inline: true, max: 80 },
          title: { label: "Title", input: "text", inline: true, max: 120 },
          subtitle: { label: "Subtitle", input: "textarea", max: 400, hint: "A sentence or two under the title." },
        },
      },
      about: {
        label: "About wording",
        fields: {
          body: {
            label: "Body",
            input: "textarea",
            max: 20000,
            hint: "Shown on the home page (its opening lines) and on /about. Blank lines make new paragraphs; a line starting mailto: becomes an email link.",
          },
        },
      },
      footer: {
        label: "Footer wording",
        fields: {
          body: { label: "Main line", input: "text", inline: true, max: 160, hint: "Appears on every page." },
          note: { label: "Second line", input: "text", inline: true, max: 200, hint: "The year and the name follow it." },
        },
      },
    },
  },
});

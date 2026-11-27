// What a tour's page lets its guide change in place (the Fields lens): pure data, read by the lens in the browser (labels,
// limits) and by the server (allow-list, the same limits again in lib/tour-fields.ts). Wording is for a tour guide.
//
//   record:tour:<tour id>:title | excerpt | goodToKnow | contact
//   record:tourstop:<stop id>:line
//
// The kinds carry no `capability`: the catalogue (packages/actions) has no entry for a tour's words and this site does not
// depend on that package yet, so the save goes through lib/tour-fields.ts, which checks the person against THIS tour.

import { defineFields, siteFieldsRegistry } from "@elkdonis/house-editor/fields/server";

export const tourFieldsRegistry = defineFields({
  tour: {
    heading: "This tour",
    label: "This tour",
    shared: "This changes the tour itself, everywhere it appears: its page, its cards and its lists.",
    fields: {
      title: { label: "Tour title", input: "text", max: 200, optional: false },
      excerpt: {
        label: "What to expect",
        hint: "A few lines that open the tour's page and its card. Leave it empty to use the start of the long description.",
        input: "textarea",
        max: 300,
      },
      goodToKnow: {
        label: "Good to know",
        hint: "One point per line. Each shows as a bullet, above the contact line.",
        input: "list",
        max: 300,
        maxItems: 30,
      },
      contact: {
        label: "Contact line",
        hint: "Who to write to with a question. Leave it empty to show the office's address.",
        input: "text",
        max: 200,
      },
    },
  },
  tourstop: {
    heading: "This stop",
    label: "This stop",
    shared: "This line is on the tour's page for everyone to read.",
    fields: {
      line: {
        label: "Walk-through line",
        hint: "One or two lines about this stop, as the walk goes. Plain text.",
        input: "textarea",
        max: 300,
      },
    },
  },
});

/** Everything the lens may open on this site: the shared kinds and the tour's own. */
export const elktoursFieldsRegistry = { ...siteFieldsRegistry, ...tourFieldsRegistry };

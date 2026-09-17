import { defineBlock, type PropsOf } from "../registry";
import { ContactFormView } from "./contact-form.client";

// ============================================================================
// A contact form.
//
// The first block that TALKS TO A SERVER, and the reasons it is still allowed
// to live in a presentational library:
//
//   - it posts to a FIXED PATH, `/api/contact`, not to an address the author
//     types. An endpoint field would look like flexibility and be a hole: a
//     block placed by any member could point a form at anywhere, and every
//     visitor who filled it in would send their name and message there.
//   - it knows nothing about the organisation. The route resolves the org from
//     the deployment, so a form cannot file a message under someone else's
//     name by being copied to another page.
//   - it stores nothing and reads nothing. It sends, and reports what the
//     server said.
//
// Every site that offers this block needs that one route. A site without it
// gets a form that fails honestly on submit rather than a form that silently
// swallows what people write — which is the worse of the two failures, and the
// one a "just log it" implementation produces.
// ============================================================================

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "Get in touch" },
  {
    name: "intro",
    kind: "text",
    label: "Introduction",
    description: "A line or two above the fields.",
    default: "",
  },
  {
    name: "topics",
    kind: "list",
    label: "Subjects",
    description:
      "Offered as a menu — commissions, exhibitions, press. Leave empty for no menu.",
    default: [],
  },
  { name: "submitLabel", kind: "string", label: "Button", default: "Send" },
  {
    name: "success",
    kind: "text",
    label: "After sending",
    default: "Thank you — your message has been sent.",
  },
  {
    name: "note",
    kind: "string",
    label: "Small print",
    description: "Shown under the button, e.g. how soon you usually reply.",
    default: "",
  },
] as const;

export type ContactFormProps = PropsOf<typeof props>;

/**
 * Re-exported under the name the catalogue and every consumer use. The split
 * between this file and ./contact-form.client is a Next boundary, not an API.
 */
export const ContactForm = ContactFormView;

export const contactForm = defineBlock(
  {
    id: "contact-form",
    label: "Contact form",
    category: "actions",
    description: "A form that sends a message to whoever runs this site.",
    // Not member-safe: a form is a channel INTO the organisation, and which
    // pages carry one is an editor's decision rather than a member's.
    memberSafe: false,
    // Runs in the browser, so an editor must not hand it the ambient context
    // it gives every other block — see BlockDef.interactive.
    interactive: true,
    styling: "tokens",
    props,
  },
  ContactFormView,
  () => ({
    heading: "Get in touch",
    intro: "Please use this form for inquiries of all kinds.",
    topics: ["A commission", "An exhibition", "Press", "Something else"],
    submitLabel: "Send",
    success: "Thank you — your message has been sent.",
    note: "",
  })
);

import { SectionEditor } from "@/components/manage/section-editor";
import { getSiteSections } from "@/lib/data";

/**
 * The wording on the fixed parts of the site — hero, about, visiting
 * information, footer. Stored in org_site_sections as JSON, following the
 * pattern IFAC established (migration 041).
 *
 * Fields are declared here rather than being free-form JSON so an editor sees
 * labelled inputs instead of a blob.
 */
const SECTIONS: {
  key: string;
  title: string;
  hint: string;
  fields: { name: string; label: string; multiline?: boolean }[];
}[] = [
  {
    key: "hero",
    title: "Home page header",
    hint: "The first thing anyone sees. Leave a field empty to keep the wording already on the page.",
    fields: [
      { name: "eyebrow", label: "Small label above the title" },
      { name: "title", label: "Title" },
      { name: "subtitle", label: "Subtitle", multiline: true },
      { name: "tagline", label: "Sentence under the rule", multiline: true },
      { name: "cta_label", label: "Main button wording" },
      { name: "cta_href", label: "Main button link" },
    ],
  },
  {
    key: "about",
    title: "Our tradition",
    hint: "Shown on the home page and at the top of /about.",
    fields: [
      { name: "title", label: "Heading" },
      { name: "body", label: "Body", multiline: true },
    ],
  },
  {
    key: "visiting",
    title: "Visiting",
    hint: "Address and what a first-time visitor needs to know.",
    fields: [
      { name: "title", label: "Heading" },
      { name: "address", label: "Address" },
      { name: "body", label: "Body", multiline: true },
      { name: "notes", label: "Smaller note underneath", multiline: true },
    ],
  },
  {
    key: "resources",
    title: "Resources page",
    hint: "Intro text above the texts and sheets.",
    fields: [
      { name: "title", label: "Heading" },
      { name: "body", label: "Body", multiline: true },
    ],
  },
  {
    key: "footer",
    title: "Footer",
    hint: "Appears on every page.",
    fields: [
      { name: "body", label: "Main line" },
      { name: "note", label: "Second line" },
    ],
  },
];

export default async function ManagePagesPage() {
  const sections = await getSiteSections();

  return (
    <>
      <h2 className="font-serif text-2xl">Site copy</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The fixed wording around the content.
      </p>

      <div className="mt-6 space-y-4">
        {SECTIONS.map((section) => (
          <SectionEditor
            key={section.key}
            sectionKey={section.key}
            title={section.title}
            hint={section.hint}
            fields={section.fields}
            values={sections[section.key] ?? {}}
          />
        ))}
      </div>
    </>
  );
}

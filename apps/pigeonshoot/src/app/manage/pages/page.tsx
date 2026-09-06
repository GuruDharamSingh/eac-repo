import type { Metadata } from "next";
import { SectionEditor } from "@/components/manage/section-editor";
import { getSiteSections } from "@/lib/data";

export const metadata: Metadata = { title: "Site copy" };

/**
 * Editable copy. Every field here is a key in org_site_sections, which is why
 * the footer's map attribution lives in the database — it is a legal
 * requirement that may need correcting without a deploy.
 */
const SECTIONS = [
  {
    key: "hero",
    title: "Home page hero",
    fields: [
      { name: "title", label: "Headline" },
      { name: "subtitle", label: "Sub-headline", multiline: true },
      { name: "cta", label: "Button text" },
    ],
  },
  {
    key: "about",
    title: "About page",
    fields: [
      { name: "title", label: "Heading" },
      { name: "body", label: "Body (HTML)", multiline: true },
    ],
  },
  {
    key: "rules",
    title: "Rubric page intro",
    fields: [
      { name: "title", label: "Heading" },
      { name: "body", label: "Body (HTML)", multiline: true },
    ],
  },
  {
    key: "footer",
    title: "Footer",
    fields: [
      { name: "body", label: "Tagline" },
      { name: "credit", label: "Map data credit (legally required)", multiline: true },
    ],
  },
];

export default async function ManagePagesPage() {
  const sections = await getSiteSections();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Site copy</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Wording only. Everything else about the site is data elsewhere.
      </p>

      <div className="mt-8 space-y-8">
        {SECTIONS.map((s) => (
          <SectionEditor
            key={s.key}
            sectionKey={s.key}
            title={s.title}
            fields={s.fields}
            content={sections[s.key] ?? {}}
          />
        ))}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { getSiteSections } from "@/lib/data";
import { SectionForm, type Field } from "@/components/manage/section-form";

export const metadata: Metadata = { title: "Books ahead" };

const FIELDS: Field[] = [
  {
    key: "items",
    label: "One book per line",
    type: "books",
    hint: "Title | Author | Link | Note — everything after the title is optional. A line with no link is listed without one.",
  },
];

export default async function Page() {
  const sections = await getSiteSections();
  return (
    <>
      <h1 style={{ fontSize: "1.6rem" }}>Books ahead</h1>
      <p style={{ margin: "8px 0 20px", maxWidth: "64ch", color: "var(--ink-muted)" }}>The plain hyperlink list on the front page.</p>
      <SectionForm sectionKey="suggested_books" fields={FIELDS} initial={sections.suggested_books ?? {}} />
    </>
  );
}

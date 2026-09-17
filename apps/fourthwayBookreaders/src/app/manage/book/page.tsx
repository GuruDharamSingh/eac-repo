import type { Metadata } from "next";
import { getSiteSections } from "@/lib/data";
import { SectionForm, type Field } from "@/components/manage/section-form";

export const metadata: Metadata = { title: "The book" };

const FIELDS: Field[] = [
  { key: "title", label: "Title", type: "text" },
  { key: "author", label: "Author", type: "text" },
  { key: "edition", label: "Edition", type: "text", hint: "Which printing the page numbers follow." },
  { key: "coverUrl", label: "Cover", type: "upload", accept: "image/*", hint: "Left empty, a cloth cover is drawn with the title on it." },
  { key: "blurb", label: "About the book", type: "textarea", rows: 5 },
  { key: "review", label: "A line of praise", type: "textarea", rows: 2 },
  { key: "reviewSource", label: "Who said it", type: "text" },
  { key: "currentPage", label: "The page we are on", type: "number" },
  { key: "totalPages", label: "Pages in this edition", type: "number" },
  {
    key: "pages",
    label: "Transcribed pages",
    type: "pages",
    hint: "Open each page with a marker line:  === 47 ===   or   === 47 | Chapter title ===   then its paragraphs, separated by blank lines. Only transcribe text you have the right to publish.",
  },
];

export default async function Page() {
  const sections = await getSiteSections();
  return (
    <>
      <h1 style={{ fontSize: "1.6rem" }}>The book</h1>
      <p style={{ margin: "8px 0 20px", maxWidth: "64ch", color: "var(--ink-muted)" }}>The book the circle is reading. The pages you type here are what the hero shows as paper, and what /books opens to.</p>
      <SectionForm sectionKey="current_book" fields={FIELDS} initial={sections.current_book ?? {}} />
    </>
  );
}

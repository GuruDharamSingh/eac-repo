import type { Metadata } from "next";
import { getSiteSections } from "@/lib/data";
import { SectionForm, type Field } from "@/components/manage/section-form";

export const metadata: Metadata = { title: "Structure of a meeting" };

const FIELDS: Field[] = [
  { key: "title", label: "Heading", type: "text" },
  { key: "body", label: "The structure", type: "richtext" },
  { key: "documentUrl", label: "Handout (PDF or document)", type: "upload", accept: ".pdf,.doc,.docx,.odt,.txt" },
  { key: "documentLabel", label: "Handout link text", type: "text" },
  { key: "mediaUrl", label: "Image or diagram", type: "upload", accept: "image/*" },
];

export default async function Page() {
  const sections = await getSiteSections();
  return (
    <>
      <h1 style={{ fontSize: "1.6rem" }}>Structure of a meeting</h1>
      <p style={{ margin: "8px 0 20px", maxWidth: "64ch", color: "var(--ink-muted)" }}>How a session runs. Shown on the front page; the handout and the image are optional.</p>
      <SectionForm sectionKey="meeting_structure" fields={FIELDS} initial={sections.meeting_structure ?? {}} />
    </>
  );
}

import type { Metadata } from "next";
import { getSiteSections } from "@/lib/data";
import { SectionForm, type Field } from "@/components/manage/section-form";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Hero, banner & copy" };

const HERO: Field[] = [
  { key: "url", label: "Hero image slide", type: "upload", accept: "image/*", hint: "Optional. With no image the hero simply has one slide fewer." },
  { key: "caption", label: "Caption", type: "text" },
];
const BANNER: Field[] = [
  { key: "url", label: "Vertical banner", type: "upload", accept: "image/*", hint: "Tall and narrow (about 1 : 3.4). Left empty, a book spine is drawn." },
  { key: "href", label: "Where it links", type: "url" },
];
const MISSION: Field[] = [
  { key: "line", label: "The line under the two columns", type: "textarea", rows: 2, hint: `Left empty: “${siteConfig.missionLine}”` },
];
const ABOUT: Field[] = [{ key: "body", label: "The About page", type: "richtext" }];

export default async function Page() {
  const s = await getSiteSections();
  return (
    <div style={{ display: "grid", gap: 30 }}>
      <h1 style={{ fontSize: "1.6rem" }}>Hero, banner &amp; copy</h1>
      <SectionForm sectionKey="hero_image" fields={HERO} initial={s.hero_image ?? {}} />
      <SectionForm sectionKey="side_banner" fields={BANNER} initial={s.side_banner ?? {}} />
      <SectionForm sectionKey="mission" fields={MISSION} initial={s.mission ?? {}} />
      <SectionForm sectionKey="about" fields={ABOUT} initial={s.about ?? {}} />
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { defineBlock, RichText, type PropsOf } from "@elkdonis/blocks";
import { ArchFrame, CatalogueRow, FactsGrid, Porthole, SectionHeader } from "@/components/mobile";
import { ExpPrivateView, PeopleGridView } from "./views2.client";
import { PersonCard } from "./person-card";
import type { MobileArtist, MobileExpCard, MobileExpDetail, MobilePerson } from "./types";

// ============================================================================
// Experiences, people and About blocks (G4). Words around the data are the owner's (inlineEditable); the data
// (experiences, people, tours, dates) is locked and arrives through resolvers (lib/puck/mobile-content.ts).
// EMPTY STATES are stated per block.
// ============================================================================

const s = (v: unknown, d = "") => (typeof v === "string" ? v : d);

/* ---- m-experience-list: EMPTY: a quiet line (emptyText). ---- */
const expListProps = [{ name: "emptyText", kind: "string", label: "When there are none", default: "The first experiences are being arranged. Check back soon.", inlineEditable: true }] as const;
export const mExperienceList = defineBlock(
  {
    id: "m-experience-list", category: "content", label: "Phone experience list", description: "Experience cards with a verdigris border, the artist and where it happens.",
    memberSafe: true, dataDriven: true, styling: "tokens", props: expListProps,
    parts: { root: { label: "Experience list", sel: "> .blk-mxl" }, card: { label: "Card", sel: ".blk-mxl-card" }, empty: { label: "Empty line", sel: ".blk-mxl-empty", prop: "emptyText" } },
  },
  ({ emptyText, experiences }: PropsOf<typeof expListProps> & { experiences?: MobileExpCard[] | null }) => (
    <div className="blk blk-mxl">
      {(experiences ?? []).map((c) => (
        <Link key={c.id} href={`/experiences/${c.slug}`} className="blk-mxl-card">
          <span className="blk-mxl-head">
            <Porthole size={76} verdigris src={c.img} initial={c.title.slice(0, 1)} />
            <span className="blk-mxl-text">
              <span className="m-kicker blk-mxl-meta">{c.meta}</span>
              <span className="blk-mxl-title">{c.title}</span>
              {c.artist && <span className="blk-mxl-by">{[c.artist, c.craft].filter(Boolean).join(" · ")}</span>}
            </span>
          </span>
          {c.pitch && <span className="blk-mxl-pitch">{c.pitch}</span>}
          <span className="blk-mxl-where">{c.where}</span>
        </Link>
      ))}
      {(experiences ?? []).length === 0 && <p className="blk-mxl-empty">{emptyText}</p>}
    </div>
  ),
  () => ({ emptyText: "The first experiences are being arranged.", experiences: [{ id: "e1", slug: "sample", title: "A studio visit", meta: "In person · 90 min", artist: "An artist", craft: "Painter", pitch: "A line about it.", where: "By request", img: null }] })
);

/* ---- m-artists-row: EMPTY: hides itself. ---- */
const artistsProps = [
  { name: "sectionLabel", kind: "string", label: "Section label", default: "The artists", inlineEditable: true },
  { name: "moreLabel", kind: "string", label: "Link label", default: "All ›", inlineEditable: true },
] as const;
export const mArtistsRow = defineBlock(
  {
    id: "m-artists-row", category: "content", label: "Phone artists row", description: "A sideways row of artists. Hides itself with none.",
    memberSafe: true, dataDriven: true, styling: "tokens", props: artistsProps,
    parts: { root: { label: "Artists row", sel: "> .blk-mar" }, card: { label: "Artist", sel: ".blk-mar-card" } },
  },
  ({ sectionLabel, moreLabel, artists }: PropsOf<typeof artistsProps> & { artists?: MobileArtist[] | null }) =>
    artists && artists.length > 0 ? (
      <section className="blk blk-mar">
        <SectionHeader label={s(sectionLabel)} more={{ label: s(moreLabel, "All ›"), href: "/people" }} />
        <div className="blk-mar-row">
          {artists.map((a) => (
            <Link key={a.slug} href={`/people/${a.slug}`} className="blk-mar-card">
              <Porthole size={84} verdigris src={a.photo} initial={a.initial} />
              <span className="blk-mar-name">{a.name}</span>
              {a.craft && <span className="blk-mar-craft">{a.craft}</span>}
              {a.status && <span className="blk-mar-status">{a.status}</span>}
            </Link>
          ))}
        </div>
      </section>
    ) : null,
  () => ({ sectionLabel: "The artists", moreLabel: "All ›", artists: [{ slug: "sample", name: "An Artist", craft: "Painter", status: "By request", initial: "A", photo: null }] })
);

/* ---- m-suggest-pill: a dashed pill to /suggest. No data. ---- */
const pillProps = [{ name: "label", kind: "string", label: "Label", default: "Know an artist we should meet?", inlineEditable: true }] as const;
export const mSuggestPill = defineBlock(
  {
    id: "m-suggest-pill", category: "actions", label: "Phone suggest pill", description: "A dashed pill that opens the Suggest page.",
    memberSafe: true, styling: "tokens", props: pillProps,
    parts: { root: { label: "Suggest pill", sel: "> .blk-msp" }, label: { label: "Label", sel: ".blk-msp-label", prop: "label" } },
  },
  ({ label }: PropsOf<typeof pillProps>) => (
    <Link href="/suggest" className="blk blk-msp"><span className="blk-msp-label">{label}</span></Link>
  ),
  () => ({ label: "Know an artist we should meet?" })
);

/* ---- m-people-grid: EMPTY: the grid is simply empty (no people yet). ---- */
const gridProps = [
  { name: "chipAll", kind: "string", label: "Chip: everyone", default: "Everyone", inlineEditable: true },
  { name: "chipGuides", kind: "string", label: "Chip: guides", default: "Guides", inlineEditable: true },
  { name: "chipArtists", kind: "string", label: "Chip: artists", default: "Artists", inlineEditable: true },
] as const;
export const mPeopleGrid = defineBlock(
  {
    id: "m-people-grid", category: "content", label: "Phone people grid", description: "Guides (arch, brass) and artists (round, verdigris) in two columns, with filter chips.",
    memberSafe: true, dataDriven: true, interactive: true, styling: "tokens", props: gridProps,
    parts: {
      root: { label: "People grid", sel: "> .blk-mpg" },
      chipAll: { label: "Chip: everyone", sel: ".blk-mpg-chip-all", prop: "chipAll" },
      chipGuides: { label: "Chip: guides", sel: ".blk-mpg-chip-guides", prop: "chipGuides" },
      chipArtists: { label: "Chip: artists", sel: ".blk-mpg-chip-artists", prop: "chipArtists" },
    },
  },
  ({ chipAll, chipGuides, chipArtists, people }: PropsOf<typeof gridProps> & { people?: MobilePerson[] | null }) => (
    <PeopleGridView people={people ?? []} chipAll={chipAll} chipGuides={chipGuides} chipArtists={chipArtists} />
  ),
  () => ({ chipAll: "Everyone", chipGuides: "Guides", chipArtists: "Artists", people: [] })
);

/* ---- m-people-slider: EMPTY: hides itself. ---- */
const sliderProps = [
  { name: "sectionLabel", kind: "string", label: "Section label", default: "Local Artists", inlineEditable: true },
  { name: "moreLabel", kind: "string", label: "Link label", default: "All ›", inlineEditable: true },
] as const;
export const mPeopleSlider = defineBlock(
  {
    id: "m-people-slider", category: "content", label: "Phone people slider", description: "A snap-scrolling row of people cards. Hides itself with none.",
    memberSafe: true, dataDriven: true, styling: "tokens", props: sliderProps,
    parts: { root: { label: "People slider", sel: "> .blk-mpsl" } },
  },
  ({ sectionLabel, moreLabel, people }: PropsOf<typeof sliderProps> & { people?: MobilePerson[] | null }) =>
    people && people.length > 0 ? (
      <section className="blk blk-mpsl">
        <SectionHeader label={s(sectionLabel)} more={{ label: s(moreLabel, "All ›"), href: "/people" }} />
        <div className="blk-mpsl-row">
          {people.map((x) => (
            <PersonCard key={x.slug} x={x} slide />
          ))}
        </div>
      </section>
    ) : null,
  () => ({ sectionLabel: "Local Artists", moreLabel: "All ›", people: [] })
);

/* ---- m-about-photo: arched photo. EMPTY: hides itself until a picture is chosen. ---- */
const photoProps = [
  { name: "imageUrl", kind: "image", label: "Photo", default: "" },
  { name: "imageAlt", kind: "string", label: "Photo description", default: "" },
] as const;
export const mAboutPhoto = defineBlock(
  {
    id: "m-about-photo", category: "headers", label: "Phone arched photo", description: "One arched photo at the top of About. Hides itself without a picture.",
    memberSafe: true, styling: "tokens", props: photoProps,
    parts: { root: { label: "Photo", sel: "> .blk-map" } },
  },
  ({ imageUrl, imageAlt }: PropsOf<typeof photoProps>) =>
    imageUrl ? <div className="blk blk-map"><ArchFrame w={358} h={300} bottom={22} brass src={imageUrl} alt={imageAlt ?? ""} /></div> : null,
  () => ({ imageUrl: "", imageAlt: "" })
);

/* ---- m-prose-sections: a drop-cap paragraph and three ruled sections. EMPTY: a section with no label is skipped. ---- */
const SEC_LABEL = ["I · Tours", "II · Experiences", "III · Places & the forum"];
const SEC_TEXT = [
  "Walks led by a guide on set dates. Pick a date, say how many you are, and pay by card.",
  "Time with the artists we work with: a studio visit, a workshop, a performance.",
  "Every stop the guides know well, and a forum to talk about it.",
];
const proseProps = [
  { name: "intro", kind: "text", label: "Opening paragraph (drop cap)", default: "Guided walks and experiences in Paris. Small groups, on foot, led by people who live here.", inlineEditable: true },
  { name: "s1Label", kind: "string", label: "Section 1: label", default: SEC_LABEL[0], inlineEditable: true },
  { name: "s1Text", kind: "text", label: "Section 1: text", default: SEC_TEXT[0], inlineEditable: true },
  { name: "s2Label", kind: "string", label: "Section 2: label", default: SEC_LABEL[1], inlineEditable: true },
  { name: "s2Text", kind: "text", label: "Section 2: text", default: SEC_TEXT[1], inlineEditable: true },
  { name: "s3Label", kind: "string", label: "Section 3: label", default: SEC_LABEL[2], inlineEditable: true },
  { name: "s3Text", kind: "text", label: "Section 3: text", default: SEC_TEXT[2], inlineEditable: true },
] as const;
type ProseProps = PropsOf<typeof proseProps>;
export const mProseSections = defineBlock(
  {
    id: "m-prose-sections", category: "content", label: "Phone prose sections", description: "A drop-cap paragraph and three ruled sections.",
    memberSafe: true, styling: "tokens", props: proseProps,
    parts: {
      root: { label: "Sections", sel: "> .blk-mpr" },
      intro: { label: "Opening paragraph", sel: ".blk-mpr-intro", prop: "intro" },
      s1: { label: "Section I label", sel: ".blk-mpr-l1", prop: "s1Label" }, s1t: { label: "Section I text", sel: ".blk-mpr-t1", prop: "s1Text" },
      s2: { label: "Section II label", sel: ".blk-mpr-l2", prop: "s2Label" }, s2t: { label: "Section II text", sel: ".blk-mpr-t2", prop: "s2Text" },
      s3: { label: "Section III label", sel: ".blk-mpr-l3", prop: "s3Label" }, s3t: { label: "Section III text", sel: ".blk-mpr-t3", prop: "s3Text" },
    },
  },
  (p: ProseProps) => {
    const q = p as unknown as Record<string, ReactNode>;
    return (
      <section className="blk blk-mpr">
        {p.intro && <p className="blk-mpr-intro m-dropcap">{p.intro}</p>}
        {[1, 2, 3].map((n) =>
          q[`s${n}Label`] ? (
            <div key={n} className="blk-mpr-sec">
              <span className="m-kicker"><span className={`blk-mpr-l${n}`}>{q[`s${n}Label`]}</span></span>
              <span className="m-rule" aria-hidden="true" />
              <p className={`blk-mpr-t${n}`}>{q[`s${n}Text`]}</p>
            </div>
          ) : null,
        )}
      </section>
    );
  },
  () => ({})
);

/* ============ experience template (screen 07): every block draws nothing without an experience ============ */
type E = { exp?: MobileExpDetail | null };

export const mExpHero = defineBlock(
  {
    id: "m-exp-hero", category: "headers", label: "Phone experience hero", description: "Round picture, title, pitch and the host.",
    memberSafe: true, dataDriven: true, styling: "tokens", props: [] as const,
    parts: { root: { label: "Hero", sel: "> .blk-mxh" }, title: { label: "Title", sel: ".blk-mxh-title" } },
  },
  ({ exp }: E) =>
    exp ? (
      <header className="blk blk-mxh">
        <Porthole size={220} verdigris src={exp.img} initial={exp.title.slice(0, 1)} />
        <h1 className="blk-mxh-title">{exp.title}</h1>
        {exp.pitch && <p className="blk-mxh-pitch">{exp.pitch}</p>}
        {exp.people[0] && (
          <Link href={exp.people[0].slug ? `/people/${exp.people[0].slug}` : "#"} className="blk-mxh-host">
            <Porthole size={40} verdigris src={exp.people[0].photo} initial={exp.people[0].name.slice(0, 1)} />
            <span>{exp.people[0].name}</span>
          </Link>
        )}
      </header>
    ) : null,
  () => ({})
);

export const mExpFacts = defineBlock(
  {
    id: "m-exp-facts", category: "content", label: "Phone experience facts", description: "Length, format, where and group in a 2 by 2 grid.",
    memberSafe: true, dataDriven: true, styling: "tokens", props: [] as const,
    parts: { root: { label: "Facts", sel: "> .blk-mxf" } },
  },
  ({ exp }: E) => (exp ? <div className="blk blk-mxf"><FactsGrid items={exp.facts} /></div> : null),
  () => ({})
);

export const mExpBody = defineBlock(
  {
    id: "m-exp-body", category: "content", label: "Phone experience text", description: "The experience's own text with a drop cap. Hides itself without text.",
    memberSafe: true, dataDriven: true, styling: "tokens", props: [] as const,
    parts: { root: { label: "Text", sel: "> .blk-mtb" } },
  },
  ({ exp }: E) => (exp?.bodyHtml ? <div className="blk blk-mtb m-dropcap"><RichText body={exp.bodyHtml} /></div> : null),
  () => ({})
);

const toursLabelProps = [{ name: "label", kind: "string", label: "Section label", default: "On these tours", inlineEditable: true }] as const;
export const mExpTours = defineBlock(
  {
    id: "m-exp-tours", category: "content", label: "Phone experience tours", description: "The tours that stop at this experience. Hides itself with none.",
    memberSafe: true, dataDriven: true, styling: "tokens", props: toursLabelProps,
    parts: { root: { label: "Tours", sel: "> .blk-mxt" } },
  },
  ({ exp, label }: E & PropsOf<typeof toursLabelProps>) =>
    exp && exp.tours.length > 0 ? (
      <section className="blk blk-mxt">
        <SectionHeader label={s(label)} />
        <div className="blk-mxt-list">
          {exp.tours.map((t) => <CatalogueRow key={t.slug} href={`/tours/${t.slug}`} title={t.title} thumb={<ArchFrame w={44} h={52} bottom={7} brass />} />)}
        </div>
      </section>
    ) : null,
  () => ({ label: "On these tours" })
);

const datesLabelProps = [{ name: "label", kind: "string", label: "Section label", default: "Upcoming dates", inlineEditable: true }] as const;
export const mExpDates = defineBlock(
  {
    id: "m-exp-dates", category: "content", label: "Phone experience dates", description: "Dates the artist has accepted. Hides itself when there are none.",
    memberSafe: true, dataDriven: true, styling: "tokens", props: datesLabelProps,
    parts: { root: { label: "Dates", sel: "> .blk-mxd" } },
  },
  ({ exp, label }: E & PropsOf<typeof datesLabelProps>) =>
    exp && exp.dates.length > 0 ? (
      <section className="blk blk-mxd">
        <SectionHeader label={s(label)} />
        <div className="blk-mxd-list">
          {exp.dates.map((d) => (
            <Link key={d.id} href={`/tours/${d.tour.slug}/dates?slot=${d.id}`} className="blk-mtd-chip">
              <span className="blk-mtd-chip-day">{d.label}</span>
              <span className="blk-mtd-chip-left">{d.tour.title}</span>
            </Link>
          ))}
        </div>
      </section>
    ) : null,
  () => ({ label: "Upcoming dates" })
);

const privateProps = [
  { name: "note", kind: "text", label: "Note", default: "This one is arranged with you. Tell us when and how many, and we reply to arrange it.", inlineEditable: true },
  { name: "ctaLabel", kind: "string", label: "Button", default: "Ask about a private visit", inlineEditable: true },
  { name: "sheetTitle", kind: "string", label: "Form title (screen readers)", default: "Ask about a private visit" },
] as const;
export const mExpPrivate = defineBlock(
  {
    id: "m-exp-private", category: "actions", label: "Phone private visit", description: "A note and the button that opens the experience enquiry form.",
    memberSafe: true, dataDriven: true, interactive: true, styling: "tokens", props: privateProps,
    parts: { root: { label: "Private visit", sel: "> .blk-mxe" }, note: { label: "Note", sel: ".blk-mxe-note", prop: "note" }, cta: { label: "Button", sel: ".blk-mxe-cta", prop: "ctaLabel" } },
  },
  ({ exp, note, ctaLabel, sheetTitle }: E & PropsOf<typeof privateProps>) =>
    exp ? <ExpPrivateView id={exp.id} title={exp.title} viewerEmail={exp.viewerEmail} note={note} ctaLabel={ctaLabel} sheetTitle={s(sheetTitle, "Ask about a private visit")} /> : null,
  () => ({ note: "This one is arranged with you.", ctaLabel: "Ask about a private visit", sheetTitle: "Ask about a private visit" })
);

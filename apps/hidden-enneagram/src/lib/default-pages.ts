// ============================================================================
// The built-in pages as written in code: what each address draws until a
// version is published from the studio, and what the studio opens on until
// then (katie's default-home.ts). Puck documents, so the editor shows the
// same props. Ids are fixed so a saved document keeps them.
//
// Round 3 (2026-11-07), the quiet redesign:
//   /            DEFAULT_HOME: Welcome, the Opening, work impressions, a short
//                way into the enneagram, contact, the readings, the forum. No
//                figure and no sound on the landing.
//   /enneagram   DEFAULT_FIGURE_PAGE: the ONE exposition page. The figure
//                stays beside the text (sticky-split); Ario's chapters from the
//                old /introduction, /centers, /triads and /type-N pages
//                (lib/exposition.ts, verbatim) scroll past it; the nine types
//                are he-type rows (#type-N) that open as Surface popups.
//   /readings    DEFAULT_READINGS_PAGE: the services, then the writing.
//   /about       DEFAULT_ABOUT_PAGE: Ario (profile + statement), ifac's shape.
//   /services/<slug>  DEFAULT_SERVICE_PAGE: the template around he-service.
//   /music       DEFAULT_MUSIC_PAGE (round 2), unchanged.
//
// Words are Ario's where they exist (the old pages, the site copy in
// org_site_sections, migration 079/080). The welcome letter is a draft built
// from that copy for Ario to rewrite (PATCH_NOTES lists it).
//
// Client-safe and import-light on purpose (page routes and the studio route
// both read it): plain data only.
// ============================================================================

import { MUSIC_NOTE } from "./music-copy";
import { EXPO_INTRODUCTION, EXPO_TRIADS, TYPE_CHAPTERS, type ExpoSection } from "./exposition";
import { courseUrl } from "@/config/site";

/** The Figure's sound settings as stored props (blocks/sound-props.ts). Off for the visitor until they turn it on. */
const FIGURE_SOUND = {
  sound: true,
  tuning: "site",
  melody: "hexad",
  rotation: "1",
  rhythm: "steady",
  timbreGut: "felt",
  timbreHeart: "voice",
  timbreHead: "bell",
  mic: true,
};

const FIGURE_INTRO =
  "Nine ways the psyche contracts around a core wound. Select a point and read its fixation a step at a time — essence, then the pattern, qualities, triads, wings. Change the lens to see how the hidden triads group the nine.";

const ABOUT_BODY =
  "<p>Ario is a music educator and workshop facilitator working between rhythm and self-observation. He runs drum circle and rhythm attunement programs through Sangre House, and teaches the enneagram as a map of attention rather than a personality quiz.</p>" +
  "<p>The work here treats the nine types as habits of attention — where it goes by default, what it avoids, and what becomes available when the habit loosens. Sessions are one-on-one or in small groups.</p>";

/** One exposition section as a Passage, with its anchor. */
function passage(s: ExpoSection, anchor?: string) {
  return {
    type: "he-passage",
    props: {
      id: `he-passage-${s.id}`,
      ...(anchor ? { blkStyle: { anchor } } : {}),
      eyebrow: s.eyebrow,
      heading: s.heading,
      body: s.body,
      dropCap: false,
      links: [],
      linksAt: "below",
      width: "reading",
    },
  };
}

const intro = (id: string) => EXPO_INTRODUCTION.find((s) => s.id === id)!;
const triad = (id: string) => EXPO_TRIADS.find((s) => s.id === id)!;

const SERVICES_SHELF = {
  type: "he-shelf",
  props: {
    id: "he-shelf-home-services",
    blkStyle: { anchor: "readings" },
    eyebrow: "Readings and counselling",
    heading: "Work with Ario",
    intro: "Enneagram readings and counselling, one to one. Book and pay in one step, then suggest times that suit you.",
    source: "services",
    feed: "",
    limit: 3,
    linkLabel: "All readings",
    linkHref: "/readings",
    emptyNote: "Nothing is open for booking at the moment.",
  },
};

export const DEFAULT_HOME = {
  root: { props: { title: "The Hidden Enneagram" } },
  content: [
    {
      type: "he-welcome",
      props: {
        id: "he-welcome-home",
        heading: "Welcome.",
        subline: "A letter from Ario",
        // A draft from the site's own copy; Ario's own letter replaces it (/studio/home).
        body:
          "<p>This is a quiet place for my work with the enneagram: readings and counselling, one to one, and the writing and recordings that come out of them.</p>" +
          "<p>The work here treats the nine types as habits of attention — where it goes by default, what it avoids, and what becomes available when the habit loosens.</p>",
        signature: "Ario",
        linkLabel: "About Ario",
        linkHref: "/about",
      },
    },
    {
      type: "he-hero",
      props: {
        id: "he-hero-home",
        eyebrow: "A map of nine fixations",
        title: "The story you framed your life around",
        accent: "your life",
        lede: "The Enneagram is a map of how your core motivations became a recurring psychological fixation — and how that reaction shaped the way you relate, protect, desire, and disconnect.",
        primaryLabel: "Readings and counselling",
        primaryHref: "/readings",
        secondLabel: "The enneagram",
        secondHref: "/enneagram",
        thirdLabel: "",
        thirdHref: "",
        figure: "orb",
        image: "",
        imageAlt: "",
        titleSize: 64,
      },
    },
    {
      type: "he-shelf",
      props: {
        id: "he-shelf-home-writing",
        blkStyle: { anchor: "work" },
        eyebrow: "Work impressions",
        heading: "Writing",
        intro: "",
        source: "feed",
        feed: "writing",
        limit: 3,
        linkLabel: "All writing",
        linkHref: "/writing",
        emptyNote: "Nothing published yet.",
      },
    },
    {
      type: "he-works",
      props: {
        id: "he-works-home",
        eyebrow: "",
        heading: "Pictures and recordings",
        intro: "",
        items: [],
        emptyNote: "Pictures, recordings and video from Ario’s sessions and workshops will appear here.",
      },
    },
    { type: "he-orb", props: { id: "he-orb-home", size: "medium" } },
    {
      type: "he-passage",
      props: {
        id: "he-passage-home-enneagram",
        eyebrow: "Introduction To The System",
        heading: "What is the Enneagram?",
        body: "<p>The Enneagram is a symbolic map of movement and transformation, rooted in esoteric mathematics, music theory through the law of octaves, the law of three, and the law of seven as taught by G.I. Gurdjieff.</p>",
        dropCap: false,
        links: [{ label: "Read the exposition", note: "The figure, the centers, the triads and the nine types", href: "/enneagram" }],
        linksAt: "below",
        width: "reading",
      },
    },
    {
      type: "he-contact",
      props: {
        id: "he-contact-home",
        eyebrow: "Contact",
        heading: "Write to Ario",
        intro: "<p>A question about a reading, or about the work. Your message goes to Ario.</p>",
        nameLabel: "Your name",
        emailLabel: "Email",
        messageLabel: "Message",
        buttonLabel: "Send",
        thanks: "Thank you. Your message has been sent.",
      },
    },
    SERVICES_SHELF,
    {
      type: "he-forum",
      props: {
        id: "he-forum-home",
        eyebrow: "Forum",
        heading: "From the forum",
        intro: "Writing, questions and the dictionary.",
        limit: 4,
        linkLabel: "Enter the forum",
        linkHref: "/forum",
        emptyNote: "Writing, questions and the dictionary.",
      },
    },
  ],
};

export const DEFAULT_FIGURE_PAGE = {
  root: { props: { title: "The Enneagram" } },
  content: [
    {
      type: "he-passage",
      props: {
        id: "he-passage-expo-head",
        eyebrow: "The exposition",
        heading: "The Enneagram",
        body: `<p>${FIGURE_INTRO}</p>`,
        dropCap: false,
        links: [],
        linksAt: "below",
        width: "reading",
      },
    },
    {
      type: "sticky-split",
      props: {
        id: "sticky-split-expo",
        sideAt: "start",
        ratio: "half",
        offset: 88,
        gap: "loose",
        side: [
          {
            type: "he-enneagram",
            props: {
              id: "he-enneagram-figure",
              blkStyle: { anchor: "figure" },
              eyebrow: "",
              heading: "",
              intro: "",
              mode: "centers",
              start: "9",
              reader: "summary",
              // Small, so the wheel and its one-paragraph summary fit the window while the text scrolls.
              size: "small",
              controls: true,
              typeLinks: true,
              // `#type-N`: on this page a tap opens the type's popup (components/exposition/type-links.tsx).
              readHref: "#type-{n}",
              ...FIGURE_SOUND,
              web: "notes",
            },
          },
        ],
        main: [
          passage(intro("what-is"), "introduction"),
          passage(intro("gut-center"), "centers"),
          passage(intro("heart-center")),
          passage(intro("head-center")),
          passage(triad("triad-centers-diagram")),
          passage(intro("core-fixation"), "core-fixation"),
          passage(triad("triad-three-centers"), "triads"),
          passage(triad("triad-harmony")),
          passage(triad("triad-frustration")),
          passage(triad("triad-rejection")),
          passage(triad("triad-hexagram")),
          passage(triad("object-relations-frustration"), "object-relations"),
          passage(triad("object-relations-attachment")),
          {
            type: "he-passage",
            props: {
              id: "he-passage-types",
              blkStyle: { anchor: "types" },
              eyebrow: "Core Types",
              heading: "The nine types",
              body: "<p>Open a type to read it, here or on the figure.</p>",
              dropCap: false,
              links: [],
              linksAt: "below",
              width: "reading",
            },
          },
          ...TYPE_CHAPTERS.map((t) => ({
            type: "he-type",
            props: { id: `he-type-${t.n}`, n: String(t.n), name: t.name, epithets: t.epithets, lead: t.lead, body: t.body, pageLabel: "In the page" },
          })),
        ],
      },
    },
    { type: "he-orb", props: { id: "he-orb-expo", size: "small" } },
    {
      type: "he-passage",
      props: {
        id: "he-passage-expo-course",
        eyebrow: "",
        heading: "",
        body: "<p>A free course on Sophia walks the same map in order, one short step at a time.</p>",
        dropCap: false,
        links: [{ label: "The free course", note: "On Sophia, the network’s learning space", href: courseUrl() }],
        linksAt: "below",
        width: "reading",
      },
    },
  ],
};

export const DEFAULT_READINGS_PAGE = {
  root: { props: { title: "Readings" } },
  content: [
    {
      type: "he-passage",
      props: {
        id: "he-passage-readings-head",
        eyebrow: "Readings",
        heading: "Readings and counselling",
        body: "<p>Enneagram readings and counselling with Ario, one to one. Choose one, book and pay in a single step, then suggest times that suit you.</p>",
        dropCap: false,
        links: [],
        linksAt: "below",
        width: "reading",
      },
    },
    { ...SERVICES_SHELF, props: { ...SERVICES_SHELF.props, id: "he-shelf-readings-services", blkStyle: { anchor: "services" }, eyebrow: "", heading: "", intro: "", limit: 12, linkLabel: "", linkHref: "" } },
    { type: "he-orb", props: { id: "he-orb-readings", size: "small" } },
    {
      type: "he-shelf",
      props: {
        id: "he-shelf-readings-writing",
        blkStyle: { anchor: "articles" },
        eyebrow: "Articles",
        heading: "Writing",
        intro: "",
        source: "feed",
        feed: "writing",
        limit: 12,
        linkLabel: "",
        linkHref: "",
        emptyNote: "Nothing published yet.",
      },
    },
  ],
};

export const DEFAULT_ABOUT_PAGE = {
  root: { props: { title: "About" } },
  content: [
    {
      type: "he-person",
      props: {
        id: "he-person-about",
        slug: "aeon",
        eyebrow: "Musician · Educator · Workshop facilitator",
        heading: "About Ario",
        statement: ABOUT_BODY,
        showBio: true,
        linkLabel: "",
        linkHref: "",
      },
    },
    { type: "he-orb", props: { id: "he-orb-about", size: "small" } },
    { ...SERVICES_SHELF, props: { ...SERVICES_SHELF.props, id: "he-shelf-about-services" } },
    {
      type: "he-passage",
      props: {
        id: "he-passage-about-links",
        eyebrow: "",
        heading: "",
        body: "",
        dropCap: false,
        links: [
          { label: "The enneagram", note: "The exposition and the figure", href: "/enneagram" },
          { label: "Writing", note: "Ario’s posts", href: "/writing" },
          { label: "The forum", note: "Questions, writing and the dictionary", href: "/forum" },
          { label: "Contact", note: "Write to Ario", href: "/#contact" },
        ],
        linksAt: "below",
        width: "reading",
      },
    },
  ],
};

/** /services/<slug>: one template for every service (the service itself comes from /manage). */
export const DEFAULT_SERVICE_PAGE = {
  root: { props: { title: "Service" } },
  content: [
    {
      type: "he-service",
      props: {
        id: "he-service-main",
        serviceSlug: "",
        backLabel: "← Readings",
        backHref: "/readings",
        eyebrowOne: "A reading",
        eyebrowOther: "An offering",
        bookLabel: "Book and pay",
        amountLabel: "What you will pay",
        payNote: "You pay on Stripe’s secure page, then suggest times that suit you.",
        paidLine: "Thank you — your booking is paid.",
        whenIntro: "",
        sentLine: "Your times have been sent. You will hear back by email with one confirmed, or others offered.",
        emailLine: "The email we sent you has a link to suggest times and follow the booking.",
        cancelledLine: "Payment was cancelled; nothing was charged.",
        closedLine: "Not open for booking at the moment.",
      },
    },
  ],
};

/** /music: the web of music on its own, then the nine sounding with the twelve laid on them. */
export const DEFAULT_MUSIC_PAGE = {
  root: { props: { title: "Music" } },
  content: [
    {
      type: "he-music-web",
      props: {
        id: "he-music-web-main",
        eyebrow: "Sound",
        heading: "The web of music",
        intro:
          "<p>Twelve notes make the musical world; the enneagram has nine points. Here they sit side by side. Turn the sound on and touch a note, a point or a triad, or sing and see where your voice lands.</p>",
        view: "ring",
        tuning: "ouspensky",
        note: MUSIC_NOTE,
      },
    },
    {
      type: "he-enneagram",
      props: {
        id: "he-enneagram-music",
        eyebrow: "The octave on the figure",
        heading: "The nine, sounding",
        intro:
          "Gurdjieff’s octave runs round the circle: 9 is do, then re, mi, the first shock at 3, fa, sol, the second shock at 6, la, si and do again. The line 1-4-2-8-5-7 is a melody (re-fa-mi-si-sol-la); the triangle 3-6-9 is the two shocks and do. The ring inside shows the twelve notes against the nine.",
        mode: "centers",
        start: "9",
        reader: "none",
        size: "large",
        controls: true,
        typeLinks: true,
        readHref: "/enneagram#type-{n}",
        ...FIGURE_SOUND,
        web: "ring",
      },
    },
    {
      type: "he-passage",
      props: {
        id: "he-passage-music-sources",
        eyebrow: "Sources",
        heading: "Where this comes from",
        body:
          "<p>The placement of the notes is P. D. Ouspensky’s, <em>In Search of the Miraculous</em> (1949), chapter 14: the enneagram as “the law of seven in its union with the law of three”, seven notes and the two shocks that fill the intervals mi-fa and si-do. The harmonic-series and passing-tone tunings, the ring of nine and twelve, and the sounds given to the centres and lenses are interpretations made for this site. They are offered as music and as a way of looking, not as therapy or diagnosis.</p>",
        dropCap: false,
        links: [],
        linksAt: "below",
        width: "reading",
      },
    },
  ],
};

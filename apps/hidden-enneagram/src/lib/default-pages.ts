// ============================================================================
// The two built-in pages as written in code: what `/` and `/enneagram` draw
// until a version is published from the studio, and what the studio opens on
// until then (katie's default-home.ts). Puck documents, so the editor shows
// the same props. Ids are fixed so a saved document keeps them.
//
// The words are Ario's, carried over on 2026-11-07 so nothing is lost when
// the Silex home stops driving `/`:
//   - the Opening is the ÆON draft's hero (~/aeon-enneagram/index.html) with
//     the site copy's eyebrow (org_site_sections.hero, migration 079);
//   - "What is the Enneagram?" and "Core Fixation" are the live Silex home's
//     two sections, verbatim, with its chapter buttons as links;
//   - "About Ario" is the site copy's about section (org_site_sections.about).
// The one line not carried over: "Read more on the Enneagram of Process" (on
// the Silex home it is plain text, not a link). PATCH_NOTES lists it.
//
// Client-safe and import-light on purpose (page routes and the studio route
// both read it): plain data only.
// ============================================================================

const CHAPTERS = [
  { label: "Introduction", note: "What the system is", href: "/introduction" },
  { label: "Centers of Energy", note: "Gut, heart and head", href: "/centers" },
  { label: "Triads", note: "The three centers and their triads", href: "/triads" },
  { label: "Core Types", note: "The nine points, one by one", href: "/type-1" },
  { label: "The Figure", note: "Walk the nine points", href: "/enneagram" },
  { label: "Services / Inquiries", note: "Readings and sessions", href: "/services" },
  { label: "Contact", note: "Get in touch", href: "/contact" },
];

const FIGURE_INTRO =
  "Nine ways the psyche contracts around a core wound. Select a point and read its fixation a step at a time — essence, then the pattern, qualities, triads, wings. Change the lens to see how the hidden triads group the nine.";

const COURSE = {
  type: "he-course",
  eyebrow: "Learn",
  heading: "",
  intro: "The whole system, taught in order — short steps, a practice in each module, and reflections that stay private to you. Hosted on Sophia, the network’s learning space.",
  cardTitle: "A free walk through the map",
  cardBody:
    "Seven modules take you from the formative wound to the three centers, the core fixation and its hidden triads, wings and lines of movement, all nine types, and the instincts. Read at your own pace; nothing is graded, nothing counts your days.",
  badges: "Free, Self-paced, {steps} steps, Private reflections",
  buttonLabel: "Open the course",
  showModules: true,
};

export const DEFAULT_HOME = {
  root: { props: { title: "The Hidden Enneagram" } },
  content: [
    {
      type: "he-hero",
      props: {
        id: "he-hero-home",
        eyebrow: "A map of nine fixations",
        title: "The story you framed your life around",
        accent: "your life",
        lede: "The Enneagram is a map of how your core motivations became a recurring psychological fixation — and how that reaction shaped the way you relate, protect, desire, and disconnect. Walk the figure below, take the free course, or sit for a typing.",
        primaryLabel: "Walk the figure",
        primaryHref: "#figure",
        secondLabel: "Free course",
        secondHref: "#learn",
        thirdLabel: "Book a typing",
        thirdHref: "/services",
        figure: "sigil",
        image: "",
        imageAlt: "",
        titleSize: 64,
      },
    },
    {
      type: "he-passage",
      props: {
        id: "he-passage-what",
        eyebrow: "Introduction To The System",
        heading: "What is the Enneagram?",
        body:
          "<p>In the sections below, we describe the Enneagram’s main ideas and how the system works. Click the buttons to navigate.</p>" +
          "<p>The Enneagram is a symbolic map of movement and transformation, rooted in esoteric mathematics, music theory through the law of octaves, the law of three, and the law of seven as taught by G.I. Gurdjieff.</p>" +
          "<p>There are 9 points, each representing a general stage or quality which requires a specific change of quality to transform. Each point sits between two adjacent types — its wings — just as a musical scale moves from one tone to the next.</p>" +
          "<p>Individuals generally utilize one of three centers of intelligence to process their identity and frame their needs and place in the world. Each of the 9 points represents a relationship to the core need of one of these three Centers of Intelligence: Body, Heart, Head.</p>" +
          "<p>Consider it a radar scanner of identity that surfaces the core tensions and struggles you experience — and a guide toward understanding the deeper motivations that shape how you relate, protect, desire, and disconnect.</p>",
        dropCap: false,
        links: CHAPTERS,
        linksAt: "aside",
        width: "wide",
      },
    },
    {
      type: "he-passage",
      props: {
        id: "he-passage-fixation",
        eyebrow: "The looped pattern",
        heading: "Core Fixation",
        body:
          "<p>Once a Center has been over-activated in response to the wound, it begins to form a looped response pattern — a psychological structure that attempts to resolve the loss of stability using the same tools that were shaped by the injury itself. This is where the Core Fixation emerges.</p>" +
          "<p>Each Enneagram type follows a distinct internal sequence: a three-part script made up of the Object Relation, the Energy Orientation, and the Harmonic Style. This defines the exact relationship that the individual forms with their center of energy.</p>" +
          "<p>With self-understanding and accurate insight on your type, you can unwind this looping pattern by releasing the responsibility of thinking from one dominant center — and allowing the image, mind, and body to process the information they are each designed to process. This is the starting key to integration.</p>" +
          "<blockquote><p>The enneagram reveals the story you framed your life around to re-establish a sense of wholeness — and how that reaction shaped the way you relate, protect, desire, and disconnect.</p></blockquote>",
        dropCap: false,
        links: [],
        linksAt: "below",
        width: "reading",
      },
    },
    {
      type: "he-enneagram",
      props: {
        id: "he-enneagram-home",
        blkStyle: { anchor: "figure" },
        eyebrow: "The map itself",
        heading: "Nine points, one circle",
        intro: FIGURE_INTRO,
        mode: "centers",
        start: "9",
        reader: "summary",
        size: "large",
        controls: true,
        typeLinks: true,
        readHref: "/enneagram#type-{n}",
      },
    },
    {
      type: COURSE.type,
      props: { id: "he-course-home", blkStyle: { anchor: "learn" }, ...omitType(COURSE) },
    },
    {
      type: "he-passage",
      props: {
        id: "he-passage-about",
        eyebrow: "Musician · Educator · Workshop facilitator",
        heading: "About Ario",
        body:
          "<p>Ario is a music educator and workshop facilitator working between rhythm and self-observation. He runs drum circle and rhythm attunement programs through Sangre House, and teaches the enneagram as a map of attention rather than a personality quiz.</p>" +
          "<p>The work here treats the nine types as habits of attention — where it goes by default, what it avoids, and what becomes available when the habit loosens. Sessions are one-on-one or in small groups.</p>",
        dropCap: false,
        links: [
          { label: "Sit for a typing", note: "One-on-one Enneagram readings", href: "/services" },
          { label: "About Ario", note: "Los Angeles, USA", href: "/about" },
          { label: "The forum", note: "Writing, questions and the dictionary", href: "/forum" },
        ],
        linksAt: "aside",
        width: "wide",
      },
    },
  ],
};

export const DEFAULT_FIGURE_PAGE = {
  root: { props: { title: "The Figure" } },
  content: [
    {
      type: "he-enneagram",
      props: {
        id: "he-enneagram-figure",
        eyebrow: "The instrument",
        heading: "Nine points, one circle",
        intro: FIGURE_INTRO,
        mode: "centers",
        start: "9",
        reader: "full",
        size: "large",
        controls: true,
        typeLinks: true,
        readHref: "/enneagram#type-{n}",
      },
    },
    {
      type: "he-passage",
      props: {
        id: "he-passage-further",
        eyebrow: "Further in",
        heading: "Ario’s chapters",
        body: "<p>The figure is the map at a glance. The chapters below walk the system in Ario’s words.</p>",
        dropCap: false,
        links: CHAPTERS.filter((c) => c.href !== "/enneagram"),
        linksAt: "aside",
        width: "wide",
      },
    },
    { type: COURSE.type, props: { id: "he-course-figure", ...omitType(COURSE) } },
  ],
};

function omitType<T extends { type: string }>(o: T): Omit<T, "type"> {
  const { type: _type, ...rest } = o;
  return rest;
}


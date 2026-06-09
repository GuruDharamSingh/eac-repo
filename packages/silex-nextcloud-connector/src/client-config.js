/*
 * Silex client config — the idiomatic Silex extension surface.
 *
 * Loaded via the SILEX_CLIENT_CONFIG env var. Silex serves this file at
 * /.silex-client.js and the @silexlabs/silex-plugins runtime imports it
 * with dynamic import(), reading our default export as the plugin.
 *
 * Responsibilities:
 *   1. Push our editor stylesheet into GrapesJS canvas.styles BEFORE init,
 *      so column / split / grid layouts render correctly the moment a block
 *      is dropped.
 *   2. After GrapesJS finishes initializing, register custom component
 *      types (so traits show up in the Settings panel) and add our blocks
 *      to the BlockManager.
 *
 * Phase 1 keeps the existing <eac-embed> live-slot type. Phase 2 will
 * replace that single polymorphic type with proper Web Component
 * registrations (eac-org-feed, eac-rsvp, …) and Phase 3 will drop
 * eac-embed entirely.
 */

const SLOT_CATEGORY = "Arts Live Slots";
const LAYOUT_CATEGORY = "EAC Layout";
const TEMPLATE_CATEGORY = "EAC Templates";
const CONTENT_CATEGORY = "EAC Content";
const WORKSHOP_CATEGORY = "EAC Workshop Template";
const DOSSIER_CATEGORY = "EAC Dossier Template";
const ENNEAGRAM_CATEGORY = "EAC Enneagram Template";

const CSS_PATH = "/eac-blocks.css";
const WORKSHOP_CSS_PATH = "/eac-workshop-template.css";
const WORKSHOP_TEMPLATE_PATH = "/eac-workshop-template.json";
const DOSSIER_CSS_PATH = "/eac-dossier-classified.css";
const DOSSIER_TEMPLATE_PATH = "/eac-dossier-classified.json";
const ENNEAGRAM_CSS_PATH = "/eac-enneagram.css";
const ENNEAGRAM_TEMPLATE_PATH = "/eac-enneagram.json";

let workshopTemplatePromise = null;
let workshopCssPromise = null;
let dossierTemplatePromise = null;
let dossierCssPromise = null;
let enneagramTemplatePromise = null;
let enneagramCssPromise = null;

function sameOriginUrl(path) {
  return (typeof window !== "undefined" && window.location ? window.location.origin : "") + path;
}

function loadWorkshopTemplate() {
  if (workshopTemplatePromise) return workshopTemplatePromise;
  workshopTemplatePromise = fetch(sameOriginUrl(WORKSHOP_TEMPLATE_PATH), { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .catch((err) => {
      console.warn("[eac-client-config] could not load workshop template", err);
      return null;
    });
  return workshopTemplatePromise;
}

function loadDossierTemplate() {
  if (dossierTemplatePromise) return dossierTemplatePromise;
  dossierTemplatePromise = fetch(sameOriginUrl(DOSSIER_TEMPLATE_PATH), { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .catch((err) => {
      console.warn("[eac-client-config] could not load dossier template", err);
      return null;
    });
  return dossierTemplatePromise;
}

/**
 * Fetch the combined workshop template CSS as text. The same URL is loaded
 * by the canvas iframe via a <link> for editor display; here we also fetch
 * it as a string so it can be fed to GrapesJS `protectedCss`, which makes
 * it part of the published stylesheet without writing it into the project
 * model. The template stays the single source of truth — nothing is
 * persisted into website.json.
 */
function loadWorkshopCss() {
  if (workshopCssPromise) return workshopCssPromise;
  workshopCssPromise = fetch(sameOriginUrl(WORKSHOP_CSS_PATH), { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .catch((err) => {
      console.warn("[eac-client-config] could not load workshop css", err);
      return "";
    });
  return workshopCssPromise;
}

function loadDossierCss() {
  if (dossierCssPromise) return dossierCssPromise;
  dossierCssPromise = fetch(sameOriginUrl(DOSSIER_CSS_PATH), { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .catch((err) => {
      console.warn("[eac-client-config] could not load dossier css", err);
      return "";
    });
  return dossierCssPromise;
}

function loadEnneagramTemplate() {
  if (enneagramTemplatePromise) return enneagramTemplatePromise;
  enneagramTemplatePromise = fetch(sameOriginUrl(ENNEAGRAM_TEMPLATE_PATH), { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .catch((err) => {
      console.warn("[eac-client-config] could not load enneagram template", err);
      return null;
    });
  return enneagramTemplatePromise;
}

function loadEnneagramCss() {
  if (enneagramCssPromise) return enneagramCssPromise;
  enneagramCssPromise = fetch(sameOriginUrl(ENNEAGRAM_CSS_PATH), { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .catch((err) => {
      console.warn("[eac-client-config] could not load enneagram css", err);
      return "";
    });
  return enneagramCssPromise;
}

function traitLabel(name) {
  return String(name || "")
    .replace(/^data-/, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function slot(component, attrs) {
  let out = `<eac-embed data-eac-component="${component}" data-variant="inline"`;
  for (const key of Object.keys(attrs || {})) {
    out += ` ${key}="${String(attrs[key]).replace(/"/g, "&quot;")}"`;
  }
  const title = (attrs && attrs["data-title"]) || component;
  out += `><div class="eac-editor-placeholder"><strong>${title}</strong><span>Live Arts component renders on the public site.</span></div></eac-embed>`;
  return out;
}

const liveSlotBlocks = [
  { id: "eac-slot-feed", label: "Feed Slot", content: slot("org-feed", { "data-title": "Latest updates", "data-limit": "4" }) },
  { id: "eac-slot-workshops", label: "Workshop Slot", content: slot("workshop-cards", { "data-title": "Workshop sessions", "data-limit": "3" }) },
  { id: "eac-slot-rsvp", label: "RSVP Slot", content: slot("rsvp", { "data-title": "Reserve your place", "data-limit": "3" }) },
  { id: "eac-slot-poll", label: "Poll Slot", content: slot("poll", { "data-title": "Community poll", "data-question": "What should we offer next?", "data-options": "Practice|Workshop|Open studio" }) },
  { id: "eac-slot-live", label: "Live Slot", content: slot("live", { "data-title": "Live channel", "data-status": "Upcoming" }) },
  { id: "eac-slot-resources", label: "Resource Slot", content: slot("resources", { "data-title": "Resources", "data-items": "Notes|Replay|Worksheet" }) },
  { id: "eac-slot-inquiry", label: "Inquiry Form Slot", content: slot("inquiry", { "data-title": "Send your inquiry" }) },
];

const structureBlocks = [
  { id: "eac-section", label: "Section", content: '<section class="eac-section" data-bg="surface" data-pad="md"><div class="eac-section-inner"><div class="eac-drop"></div></div></section>' },
  { id: "eac-hero", label: "Hero", content: '<section class="eac-hero" data-overlay="true"><div class="eac-hero-bg"></div><div class="eac-hero-inner"><p class="eac-kicker">Eyebrow</p><h1 class="eac-hero-title">Hero heading</h1><p class="eac-hero-sub">Short supporting line.</p></div></section>' },
  { id: "eac-two-col", label: "Two Column", content: '<div class="eac-two-col"><div class="eac-drop"></div><div class="eac-drop"></div></div>' },
  { id: "eac-feature-split", label: "Feature Split", content: '<div class="eac-feature-split" data-reverse="false"><div class="eac-feature-media"><div class="eac-drop"></div></div><div class="eac-feature-text"><div class="eac-drop"></div></div></div>' },
  { id: "eac-three-col", label: "Three Column", content: '<div class="eac-three-col"><div class="eac-drop"></div><div class="eac-drop"></div><div class="eac-drop"></div></div>' },
  { id: "eac-stack", label: "Stack", content: '<div class="eac-stack"><div class="eac-drop"></div></div>' },
  { id: "eac-cta-band", label: "CTA Band", content: '<section class="eac-cta-band" data-bg="accent"><div class="eac-cta-inner"><h2 class="eac-cta-title">Take the next step</h2><div class="eac-cta-action eac-drop"></div></div></section>' },
  { id: "eac-footer", label: "Footer", content: '<footer class="eac-footer" data-bg="dark"><div class="eac-footer-inner"><div class="eac-footer-col"><p class="eac-kicker">Organization</p><h3 class="eac-footer-title">Site name</h3><p class="eac-footer-copy">A short line about who you are and what this surface holds.</p></div><div class="eac-footer-col"><p class="eac-kicker">Explore</p><ul class="eac-footer-list"><li><a href="#">About</a></li><li><a href="#">Workshops</a></li><li><a href="#">Updates</a></li><li><a href="#">Contact</a></li></ul></div><div class="eac-footer-col"><p class="eac-kicker">Stay close</p><ul class="eac-footer-list"><li><a href="#">Newsletter</a></li><li><a href="#">Network feed</a></li><li><a href="#">Calendar</a></li></ul></div></div><div class="eac-footer-base"><span>© Site name</span><span>Built on EAC</span></div></footer>' },
];

const templateBlocks = [
  {
    id: "eac-template-workshop",
    label: "Workshop / Offering",
    content:
      '<main class="eac-template eac-template-workshop">' +
      '<section class="eac-hero" data-overlay="true"><div class="eac-hero-bg"></div><div class="eac-hero-inner"><p class="eac-kicker">Workshop</p><h1 class="eac-hero-title">A focused session for practice and study</h1><p class="eac-hero-sub">Introduce the offering, who it is for, and what participants will leave with.</p></div></section>' +
      '<section class="eac-section" data-bg="bg" data-pad="md"><div class="eac-section-inner"><div class="eac-stack"><p class="eac-kicker">Overview</p><h2 class="eac-section-title">What this workshop opens</h2><p class="eac-section-copy">Use this space to describe the arc of the session, the tone of the work, and any preparation participants should know about.</p></div></div></section>' +
      '<div class="eac-three-col"><article class="eac-info-card"><p class="eac-kicker">Curriculum</p><h3>Core practice</h3><p>Three to five concrete topics, prompts, or exercises.</p></article><article class="eac-info-card"><p class="eac-kicker">Format</p><h3>How we meet</h3><p>Online, in person, hybrid, group size, rhythm, and access notes.</p></article><article class="eac-info-card"><p class="eac-kicker">Dates</p><h3>Upcoming sessions</h3><p>Use the live workshop slot below for real dates once content exists.</p></article></div>' +
      '<div class="eac-feature-split" data-reverse="false"><div class="eac-feature-media"></div><div class="eac-feature-text"><p class="eac-kicker">Facilitator</p><h2 class="eac-section-title">Guide this section with your voice</h2><p class="eac-section-copy">Add a photo, short bio, lineage, or context for why this offering matters now.</p></div></div>' +
      '<section class="eac-section" data-bg="surface" data-pad="md"><div class="eac-section-inner">' +
      slot("workshop-cards", { "data-title": "Upcoming sessions", "data-limit": "3" }) +
      '</div></section>' +
      '<section class="eac-cta-band" data-bg="accent"><div class="eac-cta-inner"><h2 class="eac-cta-title">Reserve your place</h2><div class="eac-cta-action">' +
      slot("rsvp", { "data-title": "Reserve your place", "data-limit": "3" }) +
      '</div></div></section>' +
      "</main>",
  },
  {
    id: "eac-template-artist",
    label: "Artist Profile",
    content:
      '<main class="eac-template eac-template-artist">' +
      '<section class="eac-hero" data-overlay="true"><div class="eac-hero-bg"></div><div class="eac-hero-inner"><p class="eac-kicker">City / region</p><h1 class="eac-hero-title">Artist name</h1><p class="eac-hero-sub">A short line about the practice, offering, or body of work.</p></div></section>' +
      '<div class="eac-feature-split" data-reverse="false"><div class="eac-feature-media"></div><div class="eac-feature-text"><p class="eac-kicker">Profile</p><h2 class="eac-section-title">A practice in motion</h2><p class="eac-section-copy">Use this block for a fuller bio, discipline list, or a plainspoken account of what you make and who it serves.</p></div></div>' +
      '<section class="eac-section" data-bg="surface" data-pad="md"><div class="eac-section-inner"><div class="eac-stack"><p class="eac-kicker">Practice</p><h2 class="eac-section-title">What the work keeps returning to</h2><p class="eac-section-copy">Describe recurring themes, materials, methods, questions, collaborations, or forms.</p></div></div></section>' +
      '<section class="eac-section" data-bg="bg" data-pad="md"><div class="eac-section-inner"><div class="eac-two-col"><div><p class="eac-kicker">Featured work</p><h2 class="eac-section-title">Current focus</h2><p class="eac-section-copy">A highlight, project, service, or experiment can sit here.</p></div><div>' +
      slot("org-feed", { "data-title": "Latest updates", "data-limit": "4" }) +
      "</div></div></div></section>" +
      '<section class="eac-section" data-bg="surface-2" data-pad="md"><div class="eac-section-inner"><div class="eac-stack"><p class="eac-kicker">Philosophy</p><h2 class="eac-section-title">Why this work matters</h2><p class="eac-section-copy">Close with a statement, working principles, or notes on what kind of contact and collaboration you welcome.</p></div></div></section>' +
      "</main>",
  },
  {
    id: "eac-template-feed",
    label: "Collective Hub",
    content:
      '<main class="eac-template eac-template-feed">' +
      '<section class="eac-section" data-bg="surface" data-pad="lg"><div class="eac-section-inner"><div class="eac-stack"><p class="eac-kicker">Collective hub</p><h1 class="eac-hero-title eac-hero-title-inline">A public surface for shared work</h1><p class="eac-section-copy">Use this page when the organization needs a calm feed, a few featured directions, and live collective updates.</p></div></div></section>' +
      '<div class="eac-three-col"><article class="eac-info-card"><p class="eac-kicker">Spotlight</p><h3>Practice</h3><p>Feature an active area of the collective.</p></article><article class="eac-info-card"><p class="eac-kicker">Gathering</p><h3>Meetings</h3><p>Point people toward the next room or session.</p></article><article class="eac-info-card"><p class="eac-kicker">Resources</p><h3>Shared library</h3><p>Surface useful links, notes, or replay material.</p></article></div>' +
      '<section class="eac-section" data-bg="bg" data-pad="md"><div class="eac-section-inner"><div class="eac-two-col"><div>' +
      slot("org-feed", { "data-title": "Latest updates", "data-limit": "6" }) +
      "</div><div>" +
      slot("community-feed", { "data-title": "Across the network", "data-limit": "4" }) +
      "</div></div></div></section>" +
      '<section class="eac-section" data-bg="surface-2" data-pad="md"><div class="eac-section-inner"><div class="eac-stack">' +
      slot("poll", { "data-title": "Community poll", "data-question": "What should we offer next?", "data-options": "Practice|Workshop|Open studio" }) +
      "</div></div></section>" +
      "</main>",
  },
];

const contentBlocks = [
  { id: "eac-heading", label: "Heading", content: '<h2 class="eac-heading">A clear heading</h2>' },
  { id: "eac-kicker", label: "Kicker", content: '<p class="eac-kicker">Eyebrow label</p>' },
  { id: "eac-paragraph", label: "Paragraph", content: '<p class="eac-prose">Use this for body copy. Keep sentences plain and the rhythm steady; the editor inherits the EAC type scale automatically.</p>' },
  { id: "eac-button", label: "Button", content: '<a class="eac-button" data-variant="solid" href="#">Call to action</a>' },
  { id: "eac-button-ghost", label: "Ghost Button", content: '<a class="eac-button" data-variant="ghost" href="#">Learn more</a>' },
  { id: "eac-image", label: "Image", content: '<figure class="eac-image"><img src="https://placehold.co/1200x720/efe9dd/5a5045?text=Image" alt="Replace with your image" /><figcaption class="eac-image-caption">Optional caption</figcaption></figure>' },
  { id: "eac-divider", label: "Divider", content: '<hr class="eac-divider" />' },
  { id: "eac-quote", label: "Quote", content: '<blockquote class="eac-quote"><p>"A line that captures what the work feels like in someone else\'s words."</p><footer class="eac-quote-attr">Speaker name, role</footer></blockquote>' },
  { id: "eac-stats-row", label: "Stats Row", content: '<div class="eac-stats-row" data-cols="3"><div class="eac-stat"><strong>120+</strong><span>Sessions held</span></div><div class="eac-stat"><strong>14</strong><span>Cities</span></div><div class="eac-stat"><strong>3</strong><span>Years running</span></div></div>' },
  { id: "eac-faq", label: "FAQ Accordion", content: '<section class="eac-faq"><h2 class="eac-section-title">Frequently asked</h2><details class="eac-faq-item" open><summary>What is included?</summary><p>Describe what someone gets when they sign up, attend, or join.</p></details><details class="eac-faq-item"><summary>Who is this for?</summary><p>Audience, prerequisites, and any access notes worth being explicit about.</p></details><details class="eac-faq-item"><summary>How do I take part?</summary><p>Mention RSVP, payment, or participation flow in plain language.</p></details></section>' },
  { id: "eac-team-card", label: "Team Card", content: '<article class="eac-team-card"><div class="eac-team-photo"></div><div class="eac-team-body"><p class="eac-kicker">Role</p><h3 class="eac-team-name">Person name</h3><p class="eac-team-bio">A short paragraph about practice, lineage, or current direction.</p></div></article>' },
  { id: "eac-team-grid", label: "Team Grid", content: '<div class="eac-team-grid"><article class="eac-team-card"><div class="eac-team-photo"></div><div class="eac-team-body"><p class="eac-kicker">Role</p><h3 class="eac-team-name">Person one</h3><p class="eac-team-bio">A short paragraph about practice or focus.</p></div></article><article class="eac-team-card"><div class="eac-team-photo"></div><div class="eac-team-body"><p class="eac-kicker">Role</p><h3 class="eac-team-name">Person two</h3><p class="eac-team-bio">A short paragraph about practice or focus.</p></div></article><article class="eac-team-card"><div class="eac-team-photo"></div><div class="eac-team-body"><p class="eac-kicker">Role</p><h3 class="eac-team-name">Person three</h3><p class="eac-team-bio">A short paragraph about practice or focus.</p></div></article></div>' },
  { id: "eac-gallery", label: "Gallery Grid", content: '<div class="eac-gallery" data-cols="3"><figure class="eac-gallery-item"><img src="https://placehold.co/800x800/efe9dd/5a5045?text=1" alt="" /></figure><figure class="eac-gallery-item"><img src="https://placehold.co/800x800/d8ddd8/5a5045?text=2" alt="" /></figure><figure class="eac-gallery-item"><img src="https://placehold.co/800x800/efe9dd/5a5045?text=3" alt="" /></figure><figure class="eac-gallery-item"><img src="https://placehold.co/800x800/d8ddd8/5a5045?text=4" alt="" /></figure><figure class="eac-gallery-item"><img src="https://placehold.co/800x800/efe9dd/5a5045?text=5" alt="" /></figure><figure class="eac-gallery-item"><img src="https://placehold.co/800x800/d8ddd8/5a5045?text=6" alt="" /></figure></div>' },
  { id: "eac-video", label: "Video Embed", content: '<div class="eac-video"><div class="eac-video-frame"><iframe src="about:blank" title="Video" frameborder="0" allowfullscreen></iframe></div><p class="eac-video-caption">Replace src with a YouTube, Vimeo, or PeerTube embed URL.</p></div>' },
  { id: "eac-logo-wall", label: "Logo Wall", content: '<section class="eac-logo-wall"><p class="eac-kicker">Trusted by</p><div class="eac-logo-row"><div class="eac-logo">Logo 1</div><div class="eac-logo">Logo 2</div><div class="eac-logo">Logo 3</div><div class="eac-logo">Logo 4</div><div class="eac-logo">Logo 5</div></div></section>' },
  { id: "eac-event-schedule", label: "Event Schedule", content: '<section class="eac-schedule"><h2 class="eac-section-title">Schedule</h2><ol class="eac-schedule-list"><li class="eac-schedule-item"><span class="eac-schedule-time">10:00</span><div class="eac-schedule-body"><h3>Opening</h3><p>Set the room and the intent for the day.</p></div></li><li class="eac-schedule-item"><span class="eac-schedule-time">11:00</span><div class="eac-schedule-body"><h3>First practice</h3><p>Move into the core exercise of the morning.</p></div></li><li class="eac-schedule-item"><span class="eac-schedule-time">13:00</span><div class="eac-schedule-body"><h3>Lunch</h3><p>Shared meal and slower conversation.</p></div></li><li class="eac-schedule-item"><span class="eac-schedule-time">14:30</span><div class="eac-schedule-body"><h3>Afternoon session</h3><p>Deepen, share, or move into smaller groups.</p></div></li><li class="eac-schedule-item"><span class="eac-schedule-time">17:00</span><div class="eac-schedule-body"><h3>Close</h3><p>Reflections and what comes next.</p></div></li></ol></section>' },
  { id: "eac-pricing", label: "Pricing Tiers", content: '<section class="eac-pricing"><div class="eac-pricing-tier"><p class="eac-kicker">Supporter</p><h3 class="eac-pricing-name">Sliding</h3><p class="eac-pricing-amount">$0+</p><ul class="eac-pricing-list"><li>Pay what you can</li><li>Full access</li><li>Community channel</li></ul><a class="eac-button" data-variant="ghost" href="#">Choose</a></div><div class="eac-pricing-tier" data-featured="true"><p class="eac-kicker">Standard</p><h3 class="eac-pricing-name">Suggested</h3><p class="eac-pricing-amount">$48</p><ul class="eac-pricing-list"><li>Sustaining rate</li><li>Full access</li><li>Replays</li></ul><a class="eac-button" data-variant="solid" href="#">Choose</a></div><div class="eac-pricing-tier"><p class="eac-kicker">Patron</p><h3 class="eac-pricing-name">Sustaining</h3><p class="eac-pricing-amount">$120</p><ul class="eac-pricing-list"><li>Help fund access</li><li>Full access</li><li>One-on-one</li></ul><a class="eac-button" data-variant="ghost" href="#">Choose</a></div></section>' },
];

function hasClass(el, name) {
  return Boolean(el && el.classList && el.classList.contains(name));
}

function registerEmbedType(editor) {
  // Phase 1: keep eac-embed as a single polymorphic type. Phase 2 replaces
  // each variant with its own Web Component type.
  editor.DomComponents.addType("eac-embed", {
    isComponent(el) {
      if (!el || !el.tagName) return false;
      return el.tagName.toLowerCase() === "eac-embed" || el.hasAttribute("data-eac-component");
    },
    model: {
      defaults: {
        tagName: "eac-embed",
        draggable: true,
        droppable: false,
        attributes: { "data-eac-component": "org-feed", "data-title": "Latest updates", "data-limit": "4" },
        traits: [
          {
            type: "select",
            name: "data-eac-component",
            label: "Component",
            options: [
              { id: "org-feed", name: "Org feed" },
              { id: "workshop-cards", name: "Workshop cards" },
              { id: "rsvp", name: "RSVP panel" },
              { id: "community-feed", name: "Network feed" },
              { id: "poll", name: "Poll" },
              { id: "countdown", name: "Countdown" },
              { id: "live", name: "Live room" },
              { id: "resources", name: "Resources" },
              { id: "inquiry", name: "Inquiry form" },
            ],
          },
          { type: "text", name: "data-title", label: "Title" },
          { type: "number", name: "data-limit", label: "Limit" },
          { type: "text", name: "data-question", label: "Question" },
          { type: "text", name: "data-options", label: "Options" },
          { type: "text", name: "data-items", label: "Items" },
        ],
      },
    },
  });
}

function registerStructureTypes(editor) {
  const add = editor.DomComponents.addType.bind(editor.DomComponents);

  const bgOptions = [
    { id: "bg", name: "Page" },
    { id: "surface", name: "Surface" },
    { id: "surface-2", name: "Surface 2" },
    { id: "dark", name: "Dark" },
    { id: "accent", name: "Accent" },
  ];
  const padOptions = [
    { id: "sm", name: "Small" },
    { id: "md", name: "Medium" },
    { id: "lg", name: "Large" },
  ];
  const boolOptions = [
    { id: "false", name: "No" },
    { id: "true", name: "Yes" },
  ];

  add("eac-section", {
    isComponent: (el) => hasClass(el, "eac-section"),
    model: { defaults: { name: "Section", traits: [
      { type: "select", name: "data-bg", label: "Background", options: bgOptions },
      { type: "select", name: "data-pad", label: "Padding", options: padOptions },
    ] } },
  });

  add("eac-hero", {
    isComponent: (el) => hasClass(el, "eac-hero"),
    model: { defaults: { name: "Hero", traits: [
      { type: "select", name: "data-overlay", label: "Overlay", options: boolOptions },
    ] } },
  });

  add("eac-two-col", {
    isComponent: (el) => hasClass(el, "eac-two-col"),
    model: { defaults: { name: "Two Column" } },
  });

  add("eac-three-col", {
    isComponent: (el) => hasClass(el, "eac-three-col"),
    model: { defaults: { name: "Three Column" } },
  });

  add("eac-feature-split", {
    isComponent: (el) => hasClass(el, "eac-feature-split"),
    model: { defaults: { name: "Feature Split", traits: [
      { type: "select", name: "data-reverse", label: "Reverse", options: boolOptions },
    ] } },
  });

  add("eac-stack", {
    isComponent: (el) => hasClass(el, "eac-stack"),
    model: { defaults: { name: "Stack" } },
  });

  add("eac-cta-band", {
    isComponent: (el) => hasClass(el, "eac-cta-band"),
    model: { defaults: { name: "CTA Band", traits: [
      { type: "select", name: "data-bg", label: "Background", options: bgOptions },
    ] } },
  });

  add("eac-footer", {
    isComponent(el) {
      if (!el || !el.tagName) return false;
      return el.tagName.toLowerCase() === "footer" && hasClass(el, "eac-footer");
    },
    model: { defaults: { name: "Footer", traits: [
      { type: "select", name: "data-bg", label: "Background", options: bgOptions },
    ] } },
  });

  add("eac-button", {
    isComponent: (el) => hasClass(el, "eac-button"),
    model: { defaults: { name: "Button", traits: [
      { type: "text", name: "href", label: "Link" },
      { type: "select", name: "data-variant", label: "Variant", options: [
        { id: "solid", name: "Solid" },
        { id: "ghost", name: "Ghost" },
      ] },
    ] } },
  });

  add("eac-stats-row", {
    isComponent: (el) => hasClass(el, "eac-stats-row"),
    model: { defaults: { name: "Stats Row", traits: [
      { type: "select", name: "data-cols", label: "Columns", options: [
        { id: "2", name: "Two" },
        { id: "3", name: "Three" },
        { id: "4", name: "Four" },
      ] },
    ] } },
  });

  add("eac-gallery", {
    isComponent: (el) => hasClass(el, "eac-gallery"),
    model: { defaults: { name: "Gallery", traits: [
      { type: "select", name: "data-cols", label: "Columns", options: [
        { id: "2", name: "Two" },
        { id: "3", name: "Three" },
        { id: "4", name: "Four" },
      ] },
    ] } },
  });

  add("eac-pricing-tier", {
    isComponent: (el) => hasClass(el, "eac-pricing-tier"),
    model: { defaults: { name: "Pricing Tier", traits: [
      { type: "select", name: "data-featured", label: "Featured", options: boolOptions },
    ] } },
  });

  add("eac-faq-item", {
    isComponent(el) {
      if (!el || !el.tagName) return false;
      return el.tagName.toLowerCase() === "details" && hasClass(el, "eac-faq-item");
    },
    model: { defaults: { name: "FAQ Item" } },
  });
}

function registerWorkshopTypes(editor, registry) {
  if (!registry || !Array.isArray(registry.sections)) return;
  if (!editor.DomComponents || !editor.DomComponents.addType) return;
  if (editor.__eacWorkshopTypesInstalled) return;
  editor.__eacWorkshopTypesInstalled = true;

  for (const section of registry.sections) {
    if (!section || !section.id) continue;
    editor.DomComponents.addType(section.id, {
      isComponent(el) {
        if (!el) return false;
        if (el.getAttribute && el.getAttribute("data-gjs-type") === section.id) return true;
        return hasClass(el, section.id);
      },
      model: {
        defaults: {
          name: section.label || section.id,
          droppable: false,
          copyable: true,
          traits: (section.traits || []).map((trait) => ({
            type: "text",
            name: trait,
            label: traitLabel(trait),
          })),
        },
      },
    });
  }
}

function registerDossierTypes(editor, registry) {
  if (!registry || !Array.isArray(registry.sections)) return;
  if (!editor.DomComponents || !editor.DomComponents.addType) return;
  if (editor.__eacDossierTypesInstalled) return;
  editor.__eacDossierTypesInstalled = true;

  for (const section of registry.sections) {
    if (!section || !section.id) continue;
    editor.DomComponents.addType(section.id, {
      isComponent(el) {
        if (!el) return false;
        if (el.getAttribute && el.getAttribute("data-gjs-type") === section.id) return true;
        return hasClass(el, section.id);
      },
      model: {
        defaults: {
          name: section.label || section.id,
          droppable: false,
          copyable: true,
          traits: (section.traits || []).map((trait) => ({
            type: "text",
            name: trait,
            label: traitLabel(trait),
          })),
        },
      },
    });
  }
}

function registerEnneagramTypes(editor, registry) {
  if (!registry || !Array.isArray(registry.sections)) return;
  if (!editor.DomComponents || !editor.DomComponents.addType) return;
  if (editor.__eacEnneagramTypesInstalled) return;
  editor.__eacEnneagramTypesInstalled = true;

  for (const section of registry.sections) {
    if (!section || !section.id) continue;
    editor.DomComponents.addType(section.id, {
      isComponent(el) {
        if (!el) return false;
        if (el.getAttribute && el.getAttribute("data-gjs-type") === section.id) return true;
        return hasClass(el, section.id);
      },
      model: {
        defaults: {
          name: section.label || section.id,
          droppable: false,
          copyable: true,
          traits: (section.traits || []).map((trait) => ({
            type: "text",
            name: trait,
            label: traitLabel(trait),
          })),
        },
      },
    });
  }
}

function addWorkshopBlocks(editor, registry) {
  if (!registry || !Array.isArray(registry.sections)) return;
  if (!editor.BlockManager || !editor.BlockManager.add) return;

  const pageBlockId = "eac-template-workshop-page";
  if (!editor.BlockManager.get || !editor.BlockManager.get(pageBlockId)) {
    const pageContent = registry.sections
      .filter((section) => section.defaultVisible !== false)
      .map((section) => section.htmlContent || "")
      .join("\n");

    editor.BlockManager.add(pageBlockId, {
      label: "Workshop page",
      category: WORKSHOP_CATEGORY,
      content: pageContent,
    });
  }

  for (const section of registry.sections) {
    if (!section || !section.id || !section.htmlContent) continue;
    const blockId = `${section.id}--block`;
    if (editor.BlockManager.get && editor.BlockManager.get(blockId)) continue;
    editor.BlockManager.add(blockId, {
      label: section.label || section.id,
      category: WORKSHOP_CATEGORY,
      content: section.htmlContent,
    });
  }
}

function addDossierBlocks(editor, registry) {
  if (!registry || !Array.isArray(registry.sections)) return;
  if (!editor.BlockManager || !editor.BlockManager.add) return;

  const pageBlockId = "eac-template-dossier-classified-page";
  if (!editor.BlockManager.get || !editor.BlockManager.get(pageBlockId)) {
    const pageContent = registry.sections
      .filter((section) => section.defaultVisible !== false)
      .map((section) => section.htmlContent || "")
      .join("\n");

    editor.BlockManager.add(pageBlockId, {
      label: "Classified dossier page",
      category: DOSSIER_CATEGORY,
      content: pageContent,
    });
  }

  for (const section of registry.sections) {
    if (!section || !section.id || !section.htmlContent) continue;
    const blockId = `${section.id}--block`;
    if (editor.BlockManager.get && editor.BlockManager.get(blockId)) continue;
    editor.BlockManager.add(blockId, {
      label: section.label || section.id,
      category: DOSSIER_CATEGORY,
      content: section.htmlContent,
    });
  }
}

function addEnneagramBlocks(editor, registry) {
  if (!registry || !Array.isArray(registry.sections)) return;
  if (!editor.BlockManager || !editor.BlockManager.add) return;

  // id → section markup, so page compositions can be stitched together.
  const sectionHtml = {};
  for (const section of registry.sections) {
    if (section && section.id) sectionHtml[section.id] = section.htmlContent || "";
  }

  // One block per page composition (Home page, Type page, …).
  const pages = Array.isArray(registry.pages) ? registry.pages : [];
  for (const page of pages) {
    if (!page || !page.id || !Array.isArray(page.sections)) continue;
    const blockId = `eac-enn-page-${page.id}`;
    if (editor.BlockManager.get && editor.BlockManager.get(blockId)) continue;
    const content = page.sections
      .map((id) => sectionHtml[id] || "")
      .filter(Boolean)
      .join("\n");
    if (!content) continue;
    editor.BlockManager.add(blockId, {
      label: page.label || page.id,
      category: ENNEAGRAM_CATEGORY,
      content,
    });
  }

  // One block per reusable section.
  for (const section of registry.sections) {
    if (!section || !section.id || !section.htmlContent) continue;
    const blockId = `${section.id}--block`;
    if (editor.BlockManager.get && editor.BlockManager.get(blockId)) continue;
    editor.BlockManager.add(blockId, {
      label: section.label || section.id,
      category: ENNEAGRAM_CATEGORY,
      content: section.htmlContent,
    });
  }
}

function addBlocks(editor, blocks, category) {
  for (const block of blocks) {
    if (editor.BlockManager.get(block.id)) continue;
    editor.BlockManager.add(block.id, {
      label: block.label,
      category,
      content: block.content,
    });
  }
}

/**
 * Seed the canonical workshop template CSS into GrapesJS' CssComposer so it
 * is:
 *   - rendered in the editor canvas,
 *   - included in editor.getCss() and therefore in the published stylesheet,
 *   - editable in the Style Manager just like any other rule.
 *
 * The CSS is fetched from /eac-workshop-template.css (the same URL used for
 * the canvas <link>). We only seed once per editor session, and we skip
 * entirely if the saved project already contains workshop rules — GrapesJS
 * persists CssComposer state into website.json, so reopening a saved
 * project would otherwise duplicate selectors. The marker check
 * ".eac-ws-" is used because every block in the template is namespaced
 * with that prefix.
 */
function seedWorkshopCssIntoEditor(editor, cssText) {
  if (!editor || !editor.Css || typeof editor.Css.addRules !== "function") return;
  if (editor.__eacWorkshopCssSeeded) return;
  editor.__eacWorkshopCssSeeded = true;

  const existingRules = typeof editor.Css.getAll === "function" ? editor.Css.getAll() : null;
  const alreadyHasWorkshopRules = existingRules
    ? existingRules.some((rule) => {
        if (!rule || typeof rule.getSelectorsString !== "function") return false;
        const sel = rule.getSelectorsString();
        return typeof sel === "string" && sel.indexOf(".eac-ws-") !== -1;
      })
    : false;
  if (alreadyHasWorkshopRules) {
    console.info("[eac-client-config] workshop css already in project, skipping seed");
    return;
  }

  if (!cssText) return;
  try {
    editor.Css.addRules(cssText);
    console.info("[eac-client-config] workshop css seeded into editor", {
      bytes: cssText.length,
    });
  } catch (err) {
    console.warn("[eac-client-config] failed to seed workshop css", err);
  }
}

function seedDossierCssIntoEditor(editor, cssText) {
  if (!editor || !editor.Css || typeof editor.Css.addRules !== "function") return;
  if (editor.__eacDossierCssSeeded) return;
  editor.__eacDossierCssSeeded = true;

  const existingRules = typeof editor.Css.getAll === "function" ? editor.Css.getAll() : null;
  const alreadyHasDossierRules = existingRules
    ? existingRules.some((rule) => {
        if (!rule || typeof rule.getSelectorsString !== "function") return false;
        const sel = rule.getSelectorsString();
        return typeof sel === "string" && (sel.indexOf(".eac-dossier-") !== -1 || sel.indexOf(".eac-dos-") !== -1);
      })
    : false;
  if (alreadyHasDossierRules) {
    console.info("[eac-client-config] dossier css already in project, skipping seed");
    return;
  }

  if (!cssText) return;
  try {
    editor.Css.addRules(cssText);
    console.info("[eac-client-config] dossier css seeded into editor", {
      bytes: cssText.length,
    });
  } catch (err) {
    console.warn("[eac-client-config] failed to seed dossier css", err);
  }
}

function seedEnneagramCssIntoEditor(editor, cssText) {
  if (!editor || !editor.Css || typeof editor.Css.addRules !== "function") return;
  if (editor.__eacEnneagramCssSeeded) return;
  editor.__eacEnneagramCssSeeded = true;

  const existingRules = typeof editor.Css.getAll === "function" ? editor.Css.getAll() : null;
  const alreadyHasEnneagramRules = existingRules
    ? existingRules.some((rule) => {
        if (!rule || typeof rule.getSelectorsString !== "function") return false;
        const sel = rule.getSelectorsString();
        return typeof sel === "string" && sel.indexOf(".eac-enn-") !== -1;
      })
    : false;
  if (alreadyHasEnneagramRules) {
    console.info("[eac-client-config] enneagram css already in project, skipping seed");
    return;
  }

  if (!cssText) return;
  try {
    editor.Css.addRules(cssText);
    console.info("[eac-client-config] enneagram css seeded into editor", {
      bytes: cssText.length,
    });
  } catch (err) {
    console.warn("[eac-client-config] failed to seed enneagram css", err);
  }
}

function openBlocksPanelIfSimpleMode(editor) {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") !== "simple") return;
    const button = editor.Panels && editor.Panels.getButton ? editor.Panels.getButton("views", "open-blocks") : null;
    if (button && button.set) button.set("active", true);
  } catch (err) {
    console.warn("[eac-client-config] could not open blocks panel", err);
  }
}

function installTypesOnEditor(editor) {
  if (editor.__eacTypesInstalled) return;
  editor.__eacTypesInstalled = true;
  registerEmbedType(editor);
  registerStructureTypes(editor);
}

function installBlocksOnEditor(
  editor,
  workshopRegistry,
  workshopCss,
  dossierRegistry,
  dossierCss,
  enneagramRegistry,
  enneagramCss
) {
  if (editor.__eacBlocksInstalled) return;
  editor.__eacBlocksInstalled = true;

  // Defensive: ensure types are registered even if the GrapesJS plugin path
  // didn't fire (e.g. config.grapesJsConfig was replaced wholesale).
  installTypesOnEditor(editor);

  addBlocks(editor, liveSlotBlocks, SLOT_CATEGORY);
  addBlocks(editor, structureBlocks, LAYOUT_CATEGORY);
  addBlocks(editor, contentBlocks, CONTENT_CATEGORY);
  addBlocks(editor, templateBlocks, TEMPLATE_CATEGORY);

  if (workshopRegistry && !editor.__eacWorkshopBlocksInstalled) {
    editor.__eacWorkshopBlocksInstalled = true;
    registerWorkshopTypes(editor, workshopRegistry);
    addWorkshopBlocks(editor, workshopRegistry);
    if (workshopCss) seedWorkshopCssIntoEditor(editor, workshopCss);
    console.info("[eac-client-config] workshop template installed");
  }

  if (dossierRegistry && !editor.__eacDossierBlocksInstalled) {
    editor.__eacDossierBlocksInstalled = true;
    registerDossierTypes(editor, dossierRegistry);
    addDossierBlocks(editor, dossierRegistry);
    if (dossierCss) seedDossierCssIntoEditor(editor, dossierCss);
    console.info("[eac-client-config] dossier template installed");
  }

  if (enneagramRegistry && !editor.__eacEnneagramBlocksInstalled) {
    editor.__eacEnneagramBlocksInstalled = true;
    registerEnneagramTypes(editor, enneagramRegistry);
    addEnneagramBlocks(editor, enneagramRegistry);
    if (enneagramCss) seedEnneagramCssIntoEditor(editor, enneagramCss);
    console.info("[eac-client-config] enneagram template installed");
  }

  console.info("[eac-client-config] installed", {
    blocks: editor.BlockManager.getAll().length,
    categories: [LAYOUT_CATEGORY, CONTENT_CATEGORY, TEMPLATE_CATEGORY, WORKSHOP_CATEGORY, DOSSIER_CATEGORY, ENNEAGRAM_CATEGORY, SLOT_CATEGORY],
  });

  setTimeout(() => openBlocksPanelIfSimpleMode(editor), 250);
}

/**
 * Default export — the Silex client plugin.
 *
 * @param {object} config  Silex ClientConfig instance.
 * @param {object} _options  Plugin options (unused).
 */
export default async function eacClientConfig(config /*, _options */) {
  // Diagnostic: confirm this module's default export actually executed.
  // If this log never appears in the browser console, /silex.js isn't being
  // imported by Silex's plugin loader (check Network tab for /silex.js?<hash>).
  try {
    console.info("[eac-client-config] plugin entry executed", {
      hasOn: typeof config?.on,
      hasGetEditor: typeof config?.getEditor,
      hasGrapesJsConfig: !!config?.grapesJsConfig,
    });
  } catch (_) { /* never throw out of a plugin entry */ }

  const [
    initialWorkshopTemplate,
    initialWorkshopCss,
    initialDossierTemplate,
    initialDossierCss,
    initialEnneagramTemplate,
    initialEnneagramCss,
  ] = await Promise.all([
    loadWorkshopTemplate(),
    loadWorkshopCss(),
    loadDossierTemplate(),
    loadDossierCss(),
    loadEnneagramTemplate(),
    loadEnneagramCss(),
  ]);

  // Expose a global hook so we (or DevTools) can manually re-install blocks
  // against an existing editor instance. Useful when diagnosing whether the
  // BlockManager.add path itself works in this Silex build.
  try {
    if (typeof window !== "undefined") {
      window.__eacInstallBlocks = function manualInstall() {
        const editor = (typeof config.getEditor === "function" && config.getEditor()) || window.editor;
        if (!editor) {
          console.warn("[eac-client-config] no editor available for manual install");
          return null;
        }
        installBlocksOnEditor(editor, initialWorkshopTemplate, initialWorkshopCss, initialDossierTemplate, initialDossierCss, initialEnneagramTemplate, initialEnneagramCss);
        return editor.BlockManager.getAll().length;
      };
    }
  } catch (_) { /* ignore */ }

  // 1. Tell GrapesJS to load our editor stylesheet into the canvas iframe
  //    AND register our component types BEFORE init. Component types must
  //    exist before GrapesJS parses the saved page HTML, otherwise nodes
  //    like <div class="eac-two-col"> log "Component type not found" and
  //    their traits panel never appears.
  config.on("silex:grapesjs:start", () => {
    const gjs = (config.grapesJsConfig = config.grapesJsConfig || {});
    const canvas = (gjs.canvas = gjs.canvas || {});
    const styles = Array.isArray(canvas.styles) ? canvas.styles : [];

    // Use an absolute, origin-qualified URL. The canvas iframe may have a
    // different base URI than the parent (about:srcdoc / blob: / data:), in
    // which case relative paths like "/eac-blocks.css" silently fail to
    // resolve and the canvas renders without our grid/column styles.
    for (const cssPath of [CSS_PATH, WORKSHOP_CSS_PATH, DOSSIER_CSS_PATH, ENNEAGRAM_CSS_PATH]) {
      for (const candidate of [cssPath, sameOriginUrl(cssPath)]) {
        if (candidate && !styles.includes(candidate)) styles.push(candidate);
      }
    }
    canvas.styles = styles;

    // GrapesJS runs each function in `plugins` during init, before loading
    // project data. Registering types here makes them available in time.
    const plugins = Array.isArray(gjs.plugins) ? gjs.plugins.slice() : [];
    plugins.push(function eacTypesPlugin(editor) {
      installTypesOnEditor(editor);
      registerWorkshopTypes(editor, initialWorkshopTemplate);
      registerDossierTypes(editor, initialDossierTemplate);
      registerEnneagramTypes(editor, initialEnneagramTemplate);
    });
    gjs.plugins = plugins;
  });

  // 2. After Silex has booted GrapesJS, add our blocks to the BlockManager.
  config.on("silex:grapesjs:end", () => {
    const editor = typeof config.getEditor === "function" ? config.getEditor() : null;
    if (!editor) {
      console.warn("[eac-client-config] grapesjs:end fired but no editor available");
      return;
    }
    installBlocksOnEditor(editor, initialWorkshopTemplate, initialWorkshopCss, initialDossierTemplate, initialDossierCss, initialEnneagramTemplate, initialEnneagramCss);
  });

  // Safety net: also try at startup:end. If grapesjs:end already fired, the
  // idempotent guard inside installBlocksOnEditor makes this a no-op.
  config.on("silex:startup:end", () => {
    const editor = typeof config.getEditor === "function" ? config.getEditor() : null;
    if (editor) installBlocksOnEditor(editor, initialWorkshopTemplate, initialWorkshopCss, initialDossierTemplate, initialDossierCss, initialEnneagramTemplate, initialEnneagramCss);
  });
}

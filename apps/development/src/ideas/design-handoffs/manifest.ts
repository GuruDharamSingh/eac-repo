// ============================================================================
// The design handoffs and canvases, as data. One entry per file in apps/development/designs/,
// plus the claude.ai canvases listed in the 2026-11-26 design-system survey (section 7).
//
// Status lines are read from the working tree on 2026-11-27 (see each `code` path); they are
// a reading of source, not a signed-in check of the live sites.
// ============================================================================

/** How the file is meant to be looked at. */
export type Frame = "phone" | "tablet" | "desktop" | "fill";

export interface Design {
  id: string;
  bundle: BundleId;
  /** Path inside the bundle folder, as delivered (spaces included). */
  file: string;
  title: string;
  what: string;
  fidelity: "high" | "mid" | "exploration" | "low" | "reference";
  /** Default frame; the viewer can switch. */
  frame: Frame;
  /** Apps the motifs apply to, first the one it was drawn for. */
  apps: string[];
  /** Matching code in this repo. */
  code: string[];
  /** The handoff's own doc for this file, inside the bundle. */
  doc?: string;
  /** What exists in the tree, briefly. */
  state: string;
  built: "built" | "partly" | "not built" | "reference";
  /** True when the file has working controls (stack, toggles, map). */
  interactive: boolean;
}

export type BundleId = "art-auction-phone-2026-11-27" | "publication-surfaces-2026-11-27" | "elktours-surface-2026-11-20";

export interface Bundle {
  id: BundleId;
  title: string;
  received: string;
  source: string;
  readme: string;
  summary: string;
}

export const BUNDLES: Bundle[] = [
  {
    id: "art-auction-phone-2026-11-27",
    title: "Art-auction on a phone · sheets",
    received: "2026-11-27",
    source: "Drawn in this app from the publication handoff's sheet rules and art-auction's current buyer and seller flows",
    readme: "README.md",
    summary:
      "Patterns for showing, buying, bidding on and launching an artwork on market.arts-collective.com at phone width: what stays a page, what opens as a sheet, and the order of the sheets in each flow. Tap through it in the phone frame.",
  },
  {
    id: "publication-surfaces-2026-11-27",
    title: "Single-page publication template · offer surfaces",
    received: "2026-11-27",
    source: "Single_page_publication_template_mockups.zip (design_handoff_publication_surfaces), drawn against apps/sunjay",
    readme: "README.md",
    summary:
      "One site per person or org, one featured offer per site; everything else (other offers, writing, talk, profiles, share, checkout) opens as a stacked surface: popup on desktop, bottom sheet on phones. Six publication kinds on one surface: writing, live events, services, series, artwork, profiles.",
  },
  {
    id: "elktours-surface-2026-11-20",
    title: "elktours on Surface UI",
    received: "2026-11-20",
    source: "Surface_UI_component_variations_1.zip (design_handoff_elktours_surface)",
    readme: "README.md",
    summary:
      "The cms-ui surface system in elktours' tokens (specimen), field and step options, the Create a tour wizard, the tour hero as a docked surface, the phone detail page and a first light theme.",
  },
];

const A = "art-auction-phone-2026-11-27" as const;
const P = "publication-surfaces-2026-11-27" as const;
const E = "elktours-surface-2026-11-20" as const;

export const DESIGNS: Design[] = [
  // ── Art-auction on a phone (2026-11-27, drawn here) ──────────────────────
  {
    id: "aa-phone",
    bundle: A,
    file: "index.html",
    title: "Artwork sheets · buy, bid, profile, launch",
    what:
      "A phone prototype of market.arts-collective.com: the gallery and a lot list as pages; a piece, its order, pay and done as sheets; registering and bidding on a lot; the artist's profile; and a seller launching a new work. The pattern rules are listed beside the frame on wide screens.",
    fidelity: "mid",
    frame: "phone",
    apps: ["art-auction (market.arts-collective.com)", "arts-collective subdomain sites (artwork offers)"],
    code: [
      "apps/art-auction/src/app/artworks/[id]/page.tsx",
      "apps/art-auction/src/app/lots/[id]/page.tsx",
      "apps/art-auction/src/app/cart/page.tsx, checkout/page.tsx",
      "apps/art-auction/src/app/center (seller popups: artwork, piece)",
      "packages/cms-ui/src/offer-surface (the kit these sheets would be built from)",
    ],
    doc: "README.md",
    state: "Design only. Nothing in art-auction changed; the market session owns that app.",
    built: "not built",
    interactive: true,
  },

  // ── Publication surfaces (2026-11-27) ───────────────────────────────────
  {
    id: "pub-canvas",
    bundle: P,
    file: "Flyer Pages Wireframes.dc.html",
    title: "Flyer pages · all rounds",
    what:
      "Pan/zoom canvas, rounds 7 (top) to 1. 7 phone heads (inline / thumb / box marks, kind tint on or off); 6 icon sets; 5 profiles and the hover profile card (5d); 4 phone sheets and head-button rules; 3 the surface system and storyboards (3c–3g); 2 six font templates (2a–2f) and live pages; 1 sketches.",
    fidelity: "high",
    frame: "fill",
    apps: ["sunjay", "arts-collective subdomain sites", "art-auction (phone)", "ifac", "amrit-canada"],
    code: [
      "packages/cms-ui/src/surface (SurfaceProvider, SurfaceFrame, url.ts ?surface=)",
      "packages/cms-ui/src/surface/surface.css:701 (phones: a bottom sheet)",
      "apps/sunjay/src/components/{profile-card,rsvp-panel,inquiry-form,signup-card}.tsx",
      "apps/arts-collective/src/components/sites/OrgDefaultPage.tsx (subdomain single page)",
    ],
    doc: "README.md",
    state:
      "cms-ui surface has the stack, crumbs, ?surface= URL and phone sheets (surface.css:701). In progress since 2026-11-27 00:44, another session, untracked: packages/cms-ui/src/offer-surface/ (look.css: --os-* tokens, the six font templates as data-ft, kind tint; icons.tsx; types.ts). Not found by grep on 2026-11-27: a hover profile card (5d), a featured-offer page layout.",
    built: "partly",
    interactive: true,
  },
  {
    id: "pub-offer-surface",
    bundle: P,
    file: "Offer Surface.dc.html",
    title: "Offer surface · every layer",
    what:
      "The one component behind every layer: svc-offer, evt-offer, evt-rsvp, wr-read, talk, share, ser-offer / ser-sub / ser-session, art-offer, art-order, pay, done, pf-owner / pf-guest / pf-member, follow. Desktop popup (400–440) and phone sheet shells. The handoff calls it the main implementation reference.",
    fidelity: "high",
    frame: "phone",
    apps: ["sunjay", "art-auction (art-offer → art-order → pay → done)", "arts-collective subdomain sites", "elktours"],
    code: [
      "packages/cms-ui/src/surface/SurfaceShell.tsx (SurfaceFrame)",
      "packages/cms-ui/src/surface/surfaces/{ArtworkSurface,ProfileSurface,ThreadSurface}.tsx",
      "packages/checkout (pay layer)",
      "packages/cms-ui/src/surface/kinds.ts (kind colours)",
      "packages/cms-ui/src/offer-surface/ (in progress, another session)",
    ],
    doc: "README.md",
    state:
      "cms-ui has the frame (head, body, foot), the stack and kinds. The square dark shell's tokens are being written in packages/cms-ui/src/offer-surface/look.css (another session, 2026-11-27). Not compared layer by layer: whether rsvp → pay → done already run as one stack anywhere. Opened alone, this file draws the svc-offer layer; its buttons call the host, so the flows play in the canvas storyboards (rounds 3–4), not here.",
    built: "partly",
    interactive: true,
  },
  {
    id: "pub-icons",
    bundle: P,
    file: "Surface Icon.dc.html",
    title: "Surface icon component",
    what:
      "One icon per kind (evt, svc, ser, art, wr, talk, pf, share, fol, done) in four sets: Things (default), Marks, Stamps, Current (text glyphs). 20-unit grid, currentColor, path data in build(). Opened alone it draws one 40×40 icon (evt, Things); the four sets side by side are in the canvas, round 6.",
    fidelity: "high",
    frame: "phone",
    apps: ["every surface host"],
    code: ["packages/cms-ui/src/surface/kinds.ts (glyphs today)", "packages/cms-ui/src/offer-surface/icons.tsx (in progress)"],
    doc: "README.md",
    state: "kinds.ts uses text glyphs (the 'Current' set). An icons.tsx is being written in packages/cms-ui/src/offer-surface/ (another session, 2026-11-27, untracked).",
    built: "partly",
    interactive: false,
  },

  // ── elktours on Surface UI (2026-11-20) ─────────────────────────────────
  {
    id: "elk-specimen",
    bundle: E,
    file: "designs/Surface UI Specimen.dc.html",
    title: "Surface UI specimen",
    what: "cms-ui/surface as it is (face, surface, page) in elktours' dark zinc and brass tokens, with findings.",
    fidelity: "high",
    frame: "desktop",
    apps: ["elktours", "every surface host"],
    code: ["packages/cms-ui/src/surface/{SurfaceCard,SurfaceShell,SurfacePage,kinds}.ts(x)", "packages/cms-ui/src/surface/surface.css", "apps/elktours/src/app/globals.css"],
    doc: "docs/01-surface-specimen.md",
    state: "Danger token fixed, --eac-font-record → Venture, `place` kind added. Hub tiles still mostly HubLinkCard; no maps in faces.",
    built: "partly",
    interactive: false,
  },
  {
    id: "elk-forms",
    bundle: E,
    file: "designs/Surface Forms.dc.html",
    title: "Field treatments 1a–1g, step placements 2a–2d",
    what: "Options, not specs: stacked fields, registry, edit in place, sentence, write the page, stop rows, one question per sheet; four places for a wizard's steps.",
    fidelity: "exploration",
    frame: "desktop",
    apps: ["elktours", "studio forms", "site-forms"],
    code: ["packages/cms-ui/src/wizard/{fields.css,StepIndicator.tsx,WizardNav.tsx}", "packages/site-forms"],
    doc: "docs/02-forms-and-steps.md",
    state: "1a in fields.css, 1f as elktours stop rows. 1b, 1c, 1d, 1e, 1g and the 2a hairline step strip are not built.",
    built: "partly",
    interactive: false,
  },
  {
    id: "elk-wizard",
    bundle: E,
    file: "designs/Create Tour Wizard.html",
    title: "Create a tour wizard (prototype)",
    what: "Hub cards → full-size wizard surface: Description → Route → Details, stacked Create place, Leaflet map with OSM tiles, draft save.",
    fidelity: "mid",
    frame: "desktop",
    apps: ["elktours"],
    code: ["apps/elktours/src/components/office/create-tour/*", "apps/elktours/src/components/office/add-place-popup.tsx"],
    doc: "docs/03-create-tour-wizard.md",
    state: "Built in office/create-tour (live, take A 2026-11-26); the built layout is preferred over this prototype.",
    built: "built",
    interactive: true,
  },
  {
    id: "elk-hero",
    bundle: E,
    file: "designs/Tour Hero Stage.dc.html",
    title: "Tour hero as a docked surface · desktop",
    what: "The tour page hero as the surface docked into the page at 1440: stage, stop strip, place and About panels.",
    fidelity: "high",
    frame: "desktop",
    apps: ["elktours", "any single-offer page"],
    code: ["packages/cms-ui/src/surface (SurfaceStage, layout docked)", "apps/elktours TourStage"],
    doc: "docs/04-tour-hero.md",
    state: "Live as SurfaceStage + elktours TourStage (2026-11-20).",
    built: "built",
    interactive: true,
  },
  {
    id: "elk-hero-phone",
    bundle: E,
    file: "designs/Tour Hero Stage Phone.dc.html",
    title: "Tour hero · phone",
    what: "The same stage at 390: dock at the bottom, pushed layers as bottom sheets.",
    fidelity: "high",
    frame: "phone",
    apps: ["elktours", "art-auction (phone)"],
    code: ["packages/cms-ui/src/surface/surface.css:4074 (.eac-stage--phone)", "apps/elktours/src/components/tours/stage/phone/tour-stage-phone.tsx"],
    doc: "docs/04-tour-hero.md",
    state: "Live as SurfaceStage layout phone + TourStagePhone.",
    built: "built",
    interactive: true,
  },
  {
    id: "elk-detail-v1",
    bundle: E,
    file: "designs/Tour Detail Page Phone.dc.html",
    title: "Tour detail page · phone v1",
    what: "Below the stage: long page plus a mid-scroll state.",
    fidelity: "high",
    frame: "tablet",
    apps: ["elktours"],
    code: ["apps/elktours/src/components/tours/stage/phone/index/tour-phone-index.tsx"],
    doc: "docs/05-tour-detail-page.md",
    state: "Superseded by v2.",
    built: "reference",
    interactive: false,
  },
  {
    id: "elk-detail-v2",
    bundle: E,
    file: "designs/Tour Detail Page Phone v2.dc.html",
    title: "Tour detail page · phone v2",
    what: "Stage → index → full page; Basteleur and Venture; the way back in the foot.",
    fidelity: "high",
    frame: "tablet",
    apps: ["elktours", "art-auction (phone piece page)"],
    code: ["apps/elktours TourStagePhone + TourPhoneIndex"],
    doc: "docs/05-tour-detail-page.md",
    state: "Live as the phone v2 page in code.",
    built: "built",
    interactive: false,
  },
  {
    id: "elk-light",
    bundle: E,
    file: "designs/Tour Detail Page Phone Light.dc.html",
    title: "Light theme · bleu de Paris, white, yellow",
    what: "v2 in a first light theme: #14284b / #2350a0 blues, white ground, #f2c14e yellow.",
    fidelity: "high",
    frame: "tablet",
    apps: ["elktours"],
    code: ["packages/cms-ui/src/surface/surface.css (--eac-surface-primary / -on-primary)"],
    doc: "docs/06-light-theme.md",
    state: "Not built; waiting on the owner.",
    built: "not built",
    interactive: false,
  },
  {
    id: "elk-hero-original",
    bundle: E,
    file: "reference/HeroCombined (original artifact).dc.html",
    title: "Hero, combined (original artifact)",
    what: "The mini-cards-as-stop-thumbnails artifact the redesign started from.",
    fidelity: "reference",
    frame: "desktop",
    apps: ["elktours"],
    code: [],
    doc: "docs/04-tour-hero.md",
    state: "Reference only.",
    built: "reference",
    interactive: true,
  },
];

/** Canvases published on claude.ai (private to the owner's account). From the 2026-11-26 survey, section 7. */
export const CANVASES: Array<{ area: string; links: Array<{ title: string; url: string }> }> = [
  {
    area: "Design system",
    links: [{ title: "Design system survey (2026-11-26)", url: "https://claude.ai/artifact/Nr2NjuTRMa727Y29Ng1Nyb" }],
  },
  {
    area: "Studio and forms",
    links: [
      { title: "Studio shell R2", url: "https://claude.ai/artifact/5P199FztbfocRXX4kZkgoy" },
      { title: "Form body / Ledger", url: "https://claude.ai/artifact/KNaDwdpnHwyxRvAAVG7eu4" },
      { title: "Pipeline frame", url: "https://claude.ai/artifact/DGHedvKtZRUp6m2hX61WUq" },
      { title: "Quick-Form", url: "https://claude.ai/artifact/RLfYxi9Hj5v3WZgScS4nSo" },
      { title: "Surface forms A/C/D/E", url: "https://claude.ai/artifact/1HQXDqAAMiEhKyY5Rm389M" },
      { title: "Schedule form", url: "https://claude.ai/artifact/VXm2uTctHs5e3Nf7RbpaEA" },
    ],
  },
  {
    area: "Content, market, hub",
    links: [
      { title: "Content library primitives", url: "https://claude.ai/artifact/7tJHCEwk5R8hs8EE8Eqe4Z" },
      { title: "Market /center and /hub R1–R6", url: "https://claude.ai/artifact/P9Xzy875cX9rNvye6szovt" },
      { title: "Center journeys", url: "https://claude.ai/artifact/FGVA7UCtiKKCGYSBQeBBVa" },
      { title: "Artist profile", url: "https://claude.ai/artifact/2LSUSVRtqYVwq86QnJzdGk" },
    ],
  },
  {
    area: "Channel",
    links: [
      { title: "Ladders, matrix, planner", url: "https://claude.ai/artifact/FwQkqK5Y8LcC8m8BeWo8Kr" },
      { title: "First console (superseded)", url: "https://claude.ai/artifact/BYQ9PEbR52mZ3EzZFRo2So" },
    ],
  },
  {
    area: "elktours",
    links: [
      { title: "Hero combined", url: "https://claude.ai/artifact/RpqJyjU5yqjV1pT8xQLeS9" },
      { title: "Tour editor takes A/B/C, Place 1/2", url: "https://claude.ai/artifact/Cb3HPqZoGYKi4gTjm3YQNF" },
    ],
  },
  {
    area: "Canvas and direct edit",
    links: [
      { title: "Canvas layer test page", url: "https://claude.ai/artifact/WzHAvvUd4tPGMqsvpfeaev" },
      { title: "First prototype", url: "https://claude.ai/artifact/2RjNrmiF7zYFAF2k3UCJkB" },
      { title: "Editor House", url: "https://claude.ai/artifact/TnTzpdr4vWUbgt1LKbzhYt" },
      { title: "Workshop wireframes", url: "https://claude.ai/artifact/VxtF2k1ZEXeWzYu5Vn6SM4" },
    ],
  },
];

/** Where the publication motifs land, by app (2026-11-27 reading). */
export const APPLIES: Array<{ app: string; motifs: string; now: string }> = [
  {
    app: "arts-collective subdomain sites (<org>.arts-collective.com)",
    motifs: "3a/4b featured-offer page; Also offered cards; writing shelf; every other offer as a surface; ?surface= share links",
    now: "OrgDefaultPage lists feeds ('What's on', feed cards); offers open their own pages, not a stacked surface.",
  },
  {
    app: "art-auction (market.arts-collective.com), phone",
    motifs: "art-offer → art-order → pay → done as sheets; pf-owner profile sheet; 7 phone heads with the thumb mark; 5d hover card on desktop",
    now: "Piece, cart and checkout are pages; /center popups use cms-ui surfaces; ProfileFlip on /center turns on hover since 2026-11-26 (source).",
  },
  {
    app: "sunjay (Para Theater)",
    motifs: "Drawn against it: rsvp, inquiry, signup, profile card, writing blocks, font template Para",
    now: "RSVP panel, series pages and writing blocks exist as page sections.",
  },
  {
    app: "elktours",
    motifs: "Docked stage (already built), done layer, square dark shell close to its zinc and brass",
    now: "SurfaceStage + TourStage live; booking is a card form in the stage.",
  },
];

/** Design pages already in this app (Next routes, basePath-relative). */
export const LOCAL_PAGES: Array<{ title: string; href: string; note: string }> = [
  { title: "A theme from five colours", href: "/ideas/five-colour-theme", note: "Palette → shades → roles → tones, on two sites (2026-11-22)" },
  { title: "One design system for the network", href: "/ideas/design-system-proposal", note: "Vocabulary and alias map beside what each app declares (2026-11-20)" },
  { title: "Theme editor with site preview", href: "/ideas/theme-editor-site-preview", note: "Editing a site theme against a live preview" },
  { title: "Design systems", href: "/design-systems", note: "Tokens per app" },
  { title: "Themes", href: "/themes", note: "Theme studio" },
];

import raw from "@/data/block-contract.json";

// ---- the scan, typed (src/data/block-contract.json is written by scripts/refresh-block-contract.mjs) -----------------

export type Status = "pass" | "fail" | "unknown" | "na";
export interface RuleResult { status: Status; evidence: string }
export interface RuleDef { id: string; rules: string; name: string; plain: string; pass: number; fail: number; unknown: number; na: number }
export interface StageDef { n: number; key: string; name: string; plain: string; new: boolean; meets: number; reached: number }
export interface BlockRow {
  id: string; label: string; app: string; owner: string; form: string; file: string; line: number; componentFile: string;
  dataDriven: boolean; stage: number; meets: boolean[];
  settings: { count: number; names: string[]; unresolved: number; source: string; places: number };
  parts: { count: number; repeating: number | null; names: string[]; source: string };
  literals: { colours: number; fonts: number; reachedColours: number; reachedFonts: number; first: string[]; sharedBy: number };
  resize: string | null; binds: string[]; inManifest: boolean;
  rules: Record<string, RuleResult>;
}
export interface Contract {
  generated: string; blockCount: number; apps: Record<string, number>; stages: StageDef[]; rules: RuleDef[]; stageRule: string;
  places: { blocksWithPlaces: number; offersDeclared: number }; unindexed: { id: string; file: string }[]; cannotTell: string[]; blocks: BlockRow[];
}
export const CONTRACT = raw as unknown as Contract;

// ---- plain-word labels -------------------------------------------------------------------------------------------------

/** The app column reads better without the package prefix. */
export const appLabel = (a: string) => (a.startsWith("package:") ? `shared (${a.slice(8)})` : a);

// ---- pinned questions (exact texts from Manjushri) --------------------------------------------------------------------

export interface Note { id: string; where: string; text: string; choices?: string[] }
export const NOTES: Note[] = [
  { id: "C1", where: "The six stages", text: "The six stages. Are these the right steps and the right names for how a block grows up?", choices: ["Right as they are", "Change a name or a step"] },
  { id: "C2", where: "A block that is not Declared", text: "A block that has not reached 'Declared'. Should it be hidden from the block list until it has, or shown with a mark?", choices: ["Hide it until declared", "Show it with a mark"] },
  { id: "C3", where: "The cursor toolbar", text: "The cursor toolbar. Is this the right set for words, pictures and record fields? What is missing?" },
  { id: "C4", where: "Undeclared means fixed", text: "Undeclared means fixed. If a block does not name something, the editor will not touch it and will say so. Is that the behaviour you want, or should the editor always offer a way in?", choices: ["Fixed, and say so", "Always offer a way in"] },
  { id: "C5", where: "Hosts and guests", text: "Hosts and guests. The first trial I would make is a meeting-thread card as host with a profile and a cover picture as guests. Is that the right first trial?", choices: ["Right first trial", "Try something else first"] },
  { id: "C6", where: "Renaming a record", text: "Renaming a record from a page changes it everywhere. Who should be allowed: owners only, or guides as well?", choices: ["Owners only", "Guides as well"] },
  { id: "C7", where: "Pencils", text: "Pencils. Should they always show for a signed-in owner, or only after pressing Edit? And should an author see pencils only on their own posts?", choices: ["Always for a signed-in owner", "Only after pressing Edit"] },
];

// ---- the six text styles of the proposed theme (THEME_SYSTEM_2026-11-22/STRUCTURE.md) --------------------------------------

export const TEXT_STYLES = ["Display", "Title", "Heading", "Body", "Small", "Label"];

// ---- the show-and-tell block ------------------------------------------------------------------------------------------

export const TOUR_CARDS_ID = "tour-cards";
export const TOUR_CARDS_CODE = `// apps/elktours/src/components/landing/tour-cards-block.tsx:81
parts: {
  card:    { label: "Card",           sel: ".tour-card",         repeat: true },
  kicker:  { label: "Card kicker",    sel: ".tour-card-kicker",  repeat: true },
  title:   { label: "Card title",     sel: ".tour-card-title",   repeat: true },
  excerpt: { label: "Card summary",   sel: ".tour-card-excerpt", repeat: true },
  price:   { label: "Card price",     sel: ".tour-card-price",   repeat: true },
  next:    { label: "Card next date", sel: ".tour-card-next",    repeat: true },
},
reads: [
  { from: "site", what: "org" },
  { from: "record", via: "picks", kinds: ["tour"] },
],`;

// ---- the rules, each with a real example kept and one broken -----------------------------------------------------------

export interface RuleText {
  id: string; side: "editor" | "block"; rule: string;
  kept: { text: string; where: string };
  broken: { text: string; where: string };
}
export const RULES: RuleText[] = [
  {
    id: "E1", side: "editor", rule: "Touch only what is declared.",
    kept: { text: "A step that names a setting the block does not have is refused, and the page is returned unchanged.", where: "packages/house-editor/src/steps/index.ts:78, DOOR2.md" },
    broken: { text: "The Cities band of the innergathering home page is a hand-built box with typed-in colours, not a declared block, so the editor can reach only its raw box looks.", where: "THEME_SYSTEM_2026-11-22/INVENTORY.md section 1, row 10" },
  },
  {
    id: "E2", side: "editor", rule: "One home per value.",
    kept: { text: "A height that is a setting has that setting as its only home: the drag handle writes it, the slider shows it.", where: "packages/blocks/src/types.ts:410 (resize)" },
    broken: { text: "A colour can be kept in 14 places on innergathering; only 5 of them can be reached from the Site style panel.", where: "INVENTORY.md section 2.3" },
  },
  {
    id: "E3", side: "editor", rule: "Every change through the door.",
    kept: { text: "Nine steps (set_prop, unset, bind, set_look, set_token, insert, move, duplicate, remove) are the only way the saved page document changes.", where: "packages/house-editor/src/steps/types.ts:20-29" },
    broken: { text: "On most pages the Edit page button leaves the canvas and opens the Puck studio, a second editor with its own history and its own save, over the same document.", where: "reports/PUCK-vs-HOUSE.md section 2, the two buttons" },
  },
  {
    id: "E4", side: "editor", rule: "Never silent: if it cannot, it says why in one line.",
    kept: { text: "Every step answers with a code and a plain sentence, such as \"There is no block ... on this page.\"", where: "packages/house-editor/src/steps/types.ts:69-81 (StepResult.say)" },
    broken: { text: "The Join section sets a background to a variable this app never defines. It does nothing, and nothing says so.", where: "apps/innergathering/src/components/landing/JoinSection.tsx:13, INVENTORY.md section 1, row 7" },
  },
  {
    id: "E5", side: "editor", rule: "Nothing reaches visitors until it is put on the page.",
    kept: { text: "The canvas keeps edits in a working copy, guards against saving over a newer version, and asks before leaving unsaved work.", where: "reports/PUCK-vs-HOUSE.md section 1 (stale-save guard, dirty guard)" },
    broken: { text: "Thirteen theme values saved for the live org turned most grounds white and black on the public site.", where: "INVENTORY.md section 0 (site_themes)" },
  },
  {
    id: "B1", side: "block", rule: "Everything meant to be changeable is declared.",
    kept: { text: "Tour cards now declare six parts, so a title can be selected and restyled once for every card.", where: "apps/elktours/src/components/landing/tour-cards-block.tsx:81-88" },
    broken: { text: "The same block had no parts until 2026-11-23. Today the scan finds {noParts} blocks that still have none.", where: "scan: rule 'Parts declared'" },
  },
  {
    id: "B2", side: "block", rule: "Undeclared means fixed, on purpose.",
    kept: { text: "The contact form is closed to assistants by name, because it sends to an address its owner set.", where: "packages/mcp/src/manifest/deny.ts:42" },
    broken: { text: "Three Series blocks of the Sunjay site declare no settings at all, so assistants are shut out of them by the \"no declaration\" rule. That is an accident, not a decision.", where: "apps/sunjay/src/blocks/home-blocks.tsx:48-76, deny.ts" },
  },
  {
    id: "B3", side: "block", rule: "Colours and text styles come from the theme's roles, never typed in.",
    kept: { text: "The five-colour specimen is drawn only with role variables. No colour value is written in its rules.", where: "apps/development/src/ideas/five-colour-theme/five-colour-theme.css:1-3" },
    broken: { text: "The shared surface stylesheet holds 196 typed-in colours (46 different hex values), none of them reachable from a theme.", where: "INVENTORY.md section 2.2 (cms-ui surface.css)" },
  },
  {
    id: "B4", side: "block", rule: "A height that is a setting has that setting as its only home.",
    kept: { text: "The figure block names its height setting in resize, so dragging the bottom edge and the slider agree.", where: "packages/blocks/src/blocks/figure.tsx (resize.height)" },
    broken: { text: "The phone masthead has a cover height setting but no resize, so a handle cannot write it.", where: "apps/elktours/src/blocks/mobile/discover.tsx:35" },
  },
  {
    id: "B5", side: "block", rule: "Words that come from a record say which record.",
    kept: { text: "Tour cards say they read tour records through their 'picks' setting.", where: "apps/elktours/src/components/landing/tour-cards-block.tsx:90-93 (reads)" },
    broken: { text: "Five of the tour page blocks read the database but name no record kind, so an editor cannot say where their words come from.", where: "scan: rule 'Record named'; apps/elktours/src/blocks/tour/config.tsx" },
  },
];

// ---- the cursor toolbar mock ----------------------------------------------------------------------------------------

export type Target = "title" | "text" | "picture" | "field";
export type Role = "visitor" | "author" | "guide" | "owner";
export const ROLES: { id: Role; label: string; can: Target[]; line: string }[] = [
  { id: "visitor", label: "Visitor", can: [], line: "A visitor sees the page. No pencils." },
  { id: "author", label: "Author", can: ["title", "text", "picture"], line: "An author changes their own things: here, the post's words and picture, not the tour record." },
  { id: "guide", label: "Guide", can: ["title", "text", "picture", "field"], line: "A guide changes their tours: the words, the picture and the record." },
  { id: "owner", label: "Owner or admin", can: ["title", "text", "picture", "field"], line: "An owner or admin changes the site: everything on it." },
];

export interface Tool { id: string; label: string; says: string }
export const TOOLBARS: Record<Target, { title: string; tools: Tool[]; why: string; extra?: string }> = {
  title: {
    title: "Words",
    tools: [
      { id: "bold", label: "Bold", says: "would make the selected words bold" },
      { id: "italic", label: "Italic", says: "would make the selected words italic" },
      { id: "link", label: "Link", says: "would ask where the selected words should lead" },
    ],
    why: "Shown because the block declares this setting as words, and the part is tied to it. Bold, italic and link appear only for a rich-text setting; a plain one shows just the text style.",
  },
  text: {
    title: "Words",
    tools: [
      { id: "bold", label: "Bold", says: "would make the selected words bold" },
      { id: "italic", label: "Italic", says: "would make the selected words italic" },
      { id: "link", label: "Link", says: "would ask where the selected words should lead" },
    ],
    why: "Shown because the block declares this setting as rich words. Text styles are the theme's six, so a style is chosen, never typed in.",
  },
  picture: {
    title: "Picture",
    tools: [
      { id: "upload", label: "Upload a new photo", says: "would open your phone's photos" },
      { id: "library", label: "Choose from the library", says: "would open the organisation's media" },
      { id: "crop", label: "Crop", says: "would let you frame the picture" },
      { id: "describe", label: "Describe", says: "would ask for a line for people who cannot see it" },
    ],
    why: "Shown because the block declares a picture setting. A picture declaration is what lets the editor offer upload and library choice there.",
    extra: "A photo uploaded for a site or tour goes into the organisation's media, stored once and referenced everywhere. Credit is optional.",
  },
  field: {
    title: "A field from a record",
    tools: [
      { id: "edit", label: "Edit", says: "would change this value on the tour record" },
      { id: "from", label: "Where it comes from", says: "would show: the tour record, field \"next date\"" },
      { id: "reset", label: "Reset", says: "would put back the record's own value" },
    ],
    why: "Shown because the block declares which record this setting is tied to (binds). With no binds the editor could offer only a typed copy.",
    extra: "Changing the record itself changes it everywhere it is shown, so who may do that is a question (C6).",
  },
};

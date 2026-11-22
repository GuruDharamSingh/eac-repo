import "./pattern-blocks.css";
import type { Idea } from "./types";

// Metadata lives here, in a server file. The page is plain text and tables: nothing on it needs the browser.
// Every path below was opened in the code on 2026-11-21; nothing is quoted from memory.

const TODAY: { what: string; path: string; note: string }[] = [
  {
    what: "Whole-page templates",
    path: "packages/blocks/src/templates/store.ts, person.ts",
    note: "A template is a list of blocks with their settings and no ids (PageTemplate: name, description, three colours, content). Four for a store section, two for a person's pages. Katie's and Para Theater's are the same shape in their own apps.",
  },
  {
    what: "The Templates tab in the editor",
    path: "packages/page-builder/src/templates/templates-plugin.tsx:63",
    note: "Picking a template swaps the whole canvas for it (it asks first if the page has blocks, and undo brings the old page back). It never adds a template to the middle of a page.",
  },
  {
    what: "A pattern written down, used by nothing",
    path: "apps/innergathering/src/lib/puck/landing-blocks.ts:57",
    note: "ABOUT_PATTERN: a heading and two columns of words, as data. Its own comment says nothing applies it yet, because the platform has no step for putting a pattern into an existing page. Nothing else in the repo reads it.",
  },
  {
    what: "Boxes that hold other blocks",
    path: "packages/direct-edit/src/puck/blocks.tsx:141",
    note: "BOX_BLOCKS: a box that holds other things, words, and a picture (plus the Live part). Pages on the canvas are trees of these.",
  },
  {
    what: "Shared layout blocks that hold other blocks",
    path: "packages/blocks/src/blocks/split-row.tsx, grid.tsx, flow-column.tsx, sticky-split.tsx, store-frame.tsx, person-columns.tsx",
    note: "Each has slots (start and end columns, the inside of a frame). A pattern is mostly a choice of these plus what is dropped into each slot.",
  },
  {
    what: "Shared small blocks",
    path: "packages/blocks/src/blocks/section-heading.tsx, prose.tsx, text-image.tsx, section-banner.tsx, card-grid.tsx, quote.tsx, link-button.tsx",
    note: "The words, picture and button pieces that patterns are filled with.",
  },
  {
    what: "A snapshot of which blocks every site page uses",
    path: "apps/development/scripts/refresh-site-pages.mjs, src/data/site-pages.json",
    note: "Baked from the database: block types in order, with containers replaced by what they hold and no content copied. Good for counting which blocks travel together; it throws away which slot each one sat in.",
  },
];

// Patterns that already exist in practice, named from the code.
const IN_PRACTICE: { name: string; where: string; made: string }[] = [
  {
    name: "About: heading and two columns",
    where: "innergathering landing, ABOUT_PATTERN (apps/innergathering/src/lib/puck/landing-blocks.ts:57)",
    made: "section-heading, then split-row holding three prose blocks",
  },
  {
    name: "A band with two columns",
    where: "Para Theater (sunjay): the band() and split() helpers (apps/sunjay/src/lib/puck/templates.ts:25, :33), used in the event page and the services page",
    made: "pt-band holding split-row; event page: pt-steps, pt-talk-room, pt-notice beside pt-event-rsvp, pt-event-materials; services page: pt-service beside pt-booking and pt-notice",
  },
  {
    name: "A framed store section",
    where: "Store templates: gallery wall, poster shop, market stall (packages/blocks/src/templates/store.ts:33, :38)",
    made: "store-frame holding store-header and store-shelf (only the frame's colours, pattern and padding change between the four)",
  },
  {
    name: "Profile: card beside featured work",
    where: "PROFILE_TEMPLATE (packages/blocks/src/templates/person.ts:22)",
    made: "person-columns with person-card in the side column and person-portfolio in the main one, under person-header",
  },
];

const OPEN: string[] = [
  "Where does a pattern live? A list in code (like the templates), or saved by an owner per site, or both? The existing templates are code only.",
  "Is a pattern a copy or a reference? A copy is simple and every part stays editable, which is how templates work now. A reference would let one change reach every page that uses it, but then the page no longer holds its own blocks.",
  "How does it go into a page? Puck has no step for adding a group of blocks at once; the Templates tab uses a whole-page swap. The new step would add a group at a chosen place and give every block a fresh id, as the Templates tab already does.",
  "Which blocks are really patterns in disguise? Some, like the offerings band and the tour cards, are one block that hides a small arrangement inside. The staging ground could tell us which ones would be better as a pattern of smaller pieces.",
  "How small should the pieces go? Justin's idea of even smaller primitives would mean splitting blocks such as those into parts. Each split changes what a stored page holds, so it needs a rule for old pages.",
  "How do we find patterns without guessing? The page snapshot above loses which slot a block sat in, so it can say which blocks travel together but not how they are nested. A second snapshot that keeps the nesting would answer it.",
];

function PatternBlocks() {
  return (
    <div className="pbk">
      <p className="dev-lede">
        Today there are two sizes of thing: a single block, and a whole-page template. Justin's idea is a middle size, a <strong>pattern</strong>: a small arrangement of blocks (a heading over two columns of words, a band
        with a form beside a description) that you can drop into any page, then change like anything else.
      </p>

      <h2>In Justin's words</h2>
      <blockquote className="pbk-quote">
        pattern blocks should be a thing middle ground between page templates and individual blocks ... some blocks probably incorporate things like this. or use even smaller primitive ... whats the efficiency in
        figuring these things out... using apps/development as sort of staging ground for understanding how blocks are working, made up of, could be patternized
      </blockquote>
      <p>Status: noted for a later session. Nothing here is built.</p>

      <h2>What exists today</h2>
      <div className="pbk-scroll">
        <table className="pbk-table">
          <thead>
            <tr>
              <th>Piece</th>
              <th>Where</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            {TODAY.map((t) => (
              <tr key={t.what}>
                <td>{t.what}</td>
                <td>
                  <code>{t.path}</code>
                </td>
                <td>{t.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pbk-note">
        <strong>The gap.</strong> There is no "insert a pattern" step anywhere. The only way to start from an arrangement is to begin a page from a whole-page template. (The word "pattern" also appears in the store frame, where it
        means a background texture such as dots or grain: a different thing.)
      </p>

      <h2>Patterns that already exist in practice</h2>
      <p>None of these is called a pattern in the code except the first, but each is an arrangement that was built more than once or is meant to be reused.</p>
      <div className="pbk-scroll">
        <table className="pbk-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Where it is</th>
              <th>Made of</th>
            </tr>
          </thead>
          <tbody>
            {IN_PRACTICE.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td>{p.where}</td>
                <td>{p.made}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Why the development app helps</h2>
      <p>
        This app already reads every block's declaration and bakes a list of the blocks each site page uses, so it is the natural place to look at how blocks are made up before deciding what a pattern is. What it holds today
        is listed above; what it would need is the nesting kept, and a place to try a pattern on a sample page without touching a live site.
      </p>

      <h2>Questions for the later session</h2>
      <ol className="pbk-open">
        {OPEN.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ol>
    </div>
  );
}

const idea: Idea = {
  slug: "pattern-blocks",
  title: "Pattern blocks: between a block and a page",
  summary: "A small arrangement of blocks you can drop into any page. What the platform has now, the patterns that already exist in practice, and what is missing.",
  status: "exploring",
  added: "2026-11-21",
  refs: [
    "packages/blocks/src/templates",
    "packages/page-builder/src/templates/templates-plugin.tsx",
    "apps/innergathering/src/lib/puck/landing-blocks.ts",
    "packages/direct-edit/src/puck/blocks.tsx",
    "apps/development/scripts/refresh-site-pages.mjs",
  ],
  Component: PatternBlocks,
};

export default idea;

import "./pickers-in-puck.css";
import type { Idea } from "./types";

// Metadata lives here, in a server file. The page is plain text and tables: nothing on it needs the browser.
// Every path below was opened in the code on 2026-11-21; nothing is quoted from memory.

const EXISTS: { what: string; path: string; note: string }[] = [
  {
    what: "Picture picker (every picture setting)",
    path: "packages/page-builder/src/fields/image-field.tsx, packages/cms-ui/src/files/MediaPicker.tsx",
    note: "A setting declared as an image gets an Upload tab plus one tab per library the site names. Each site passes its own upload address and libraries in the editor's media option. It returns a picture address and copies nothing.",
  },
  {
    what: "Elktours' picture libraries",
    path: "apps/elktours/src/lib/media-libraries.ts",
    note: "Three libraries, Tours, Places and General, decided on the server from who is asking (owners and guides only). Lists pictures already stored; never lists anything under a Private folder.",
  },
  {
    what: "Record pickers for Puck (artworks, galleries, pages)",
    path: "packages/page-builder/src/fields/record-fields.tsx:431 (siteBindsFields), site-sources.ts",
    note: "A setting that declares binds gets a picker. This file covers artwork, gallery, opens-gallery, record, page-link and tile-key. Each site hands in its own lists (SiteSources); a page stores only an id. Danamccool and Katie use it.",
  },
  {
    what: "The canvas's \"From what?\" drawer",
    path: "packages/direct-edit/src/canvas/records.ts:50 (mountRecordChooser), tree-editor.ts:1409",
    note: "The same binds settings open a two-step drawer in the canvas editor: where to choose from, then what is there. The host supplies the lists. page-builder's record-sources.ts:45 builds that drawer's lists from the same SiteSources the Puck pickers read.",
  },
  {
    what: "That drawer, drawn inside a Puck setting",
    path: "apps/sunjay/src/components/studio/person-picker.tsx:41, apps/elktours/src/components/studio/person-picker.tsx",
    note: "A Puck field that mounts the canvas drawer inside Puck's right-hand panel, so one chooser serves both editors. Sunjay uses it for person, opens and record; elktours for place, place-photo, guide, experience and tour (apps/elktours/src/lib/puck/reference-kinds.ts).",
  },
  {
    what: "Artdirect's pickers",
    path: "apps/artdirect/src/components/design/OfferingPickerField.tsx, apps/artdirect/src/components/oad/ManageSpace.tsx",
    note: "Offering picker: lists only the page owner's public offerings, loaded with the page, and stores a reference such as artwork:id or thread:id. The Manage space uses the shared MediaPicker with artdirect's own upload route.",
  },
  {
    what: "The content library",
    path: "packages/content (ui/ContentLibrary.tsx, server/list.ts), docs/open/CONTENT_LIBRARY_COMPONENT_2026-11-08.md",
    note: "A shared library of pieces (threads and artwork): search, filter, bricks or list, a lightbox with a lead button. Data comes in as props; listContent reads the database for what the viewer may see. Listed as a dependency by arts-collective, sunjay and katie-the-potter only.",
  },
  {
    what: "The content library used as a chooser",
    path: "apps/arts-collective/src/components/channel/Library.tsx:25",
    note: "LibrarySurface takes an onPick; with it the library is titled \"Choose a piece\" and its lead button says \"Use this piece\". The only place it is used as a picker today. It lives in Channel on arts-collective, not in an editor.",
  },
];

const BLOCKS: { block: string; setting: string; today: string }[] = [
  {
    block: "Offerings band (the featured gathering)",
    setting: "\"Gathering to feature\", binds: \"thread\" (apps/innergathering/src/components/landing/offerings-block.tsx:30)",
    today:
      "innergathering's Puck editor passes no field for strings (apps/innergathering/src/lib/puck/config.client.ts:80), and the shared builder has no picker for a thread, so the setting is a plain box that wants a gathering's id.",
  },
  {
    block: "Featured person",
    setting: "\"Who\", binds: \"person\" (packages/blocks/src/blocks/featured-person.tsx:35)",
    today: "Sunjay and elktours give it the drawer picker. Other sites get a plain box. There is no block named \"profile picture\"; the nearest are this one and the person card (packages/blocks/src/blocks/person-card.tsx), so please confirm which Justin meant.",
  },
  {
    block: "Store shelf, profile gallery and profile store",
    setting: "binds: \"user\" (packages/blocks/src/blocks/store-shelf.tsx:26)",
    today: "A person is named by id. The shared builder has no user picker; whether a site supplies one was not checked per site.",
  },
];

const OPEN: string[] = [
  "Which block did Justin mean by the profile picture block: Featured person, the person card, or a picture setting that should choose from a person's own pictures?",
  "Should the pick be a reference (an id, followed live, as every binds setting is today) or a copy of the picture? Today's pickers store only references.",
  "One chooser for every kind, or the library for pieces and the picture picker for pictures? The library has no users and no pictures in it today.",
  "Who may open it? The elktours libraries show owners and guides only, and the content library applies the viewer's rights on the server. A picker inside Puck would need the same rule on every site.",
  "Do sites other than sunjay get the package at all? Adding it as a dependency means an install and a rebuild of each site; that is a decision for the owner, not something to slip in.",
  "Should the pop-up be the library itself (search, filters, lightbox) or a smaller version made from the same pieces? Puck's right-hand panel is narrow.",
];

function PickersInPuck() {
  return (
    <div className="pkr">
      <p className="dev-lede">
        Some blocks ask for a thing that lives somewhere else: a featured gathering, a person, a picture. Today each site wires its own way of choosing, and some blocks just show a box that wants an id. The question is whether
        one chooser, built once at the shared level, could serve Puck and the canvas for all of them.
      </p>

      <h2>In Justin's words</h2>
      <blockquote className="pkr-quote">
        the featured gathering, and the profile picture blocks need probably media / thread / user pickers. I wonder how artdirect's package may serve this or the content library may serve this... if we integrate those
        components to server level to work for things like media picker in puck too ... so like the content library component pops up in puck studio when needed. that possible?
      </blockquote>
      <p>Status: noted for a later session. Nothing here is built.</p>

      <h2>The short answer</h2>
      <p>
        <strong>Yes, it is possible, and the hardest part is already done once.</strong> A Puck setting can open the canvas's own chooser inside Puck's panel (sunjay and elktours do it today), so the shape "a chooser pops up in
        the studio when needed" exists. What stands in the way is smaller and more specific, below. It is not a research problem.
      </p>
      <ul>
        <li>
          <strong>What it would take.</strong> A Puck setting for "a piece" that opens the library in a pop-up and stores the pick. The library would need an address on the site that returns its pieces for the person asking (the
          library's loader reads the database, and Puck's preview runs in the browser, so it cannot call it directly; elktours' libraries and the sites' pickers all go through an endpoint or a server action for the same
          reason). It would also need an adapter between the library's reference (thread:id, artwork:id) and what each block stores (a bare id for the offerings band, user:id for a person).
        </li>
        <li>
          <strong>What stands in the way.</strong> The library lists pieces only, meaning threads and artwork. It has no pictures and no people, so it cannot be the media picker or the user picker without growing. Its styles
          lean on Channel's stylesheet or the content stylesheet, which a site's editor would have to load. Only three apps depend on the package, and adding it to innergathering (where the featured gathering block is) is an
          install and a rebuild. And the lightbox is built for a wide surface, not Puck's narrow side panel.
        </li>
        <li>
          <strong>What is cheaper.</strong> For the featured gathering and the people, the drawer picker that sunjay and elktours already use needs only a list of choices from each site. For pictures, MediaPicker already is the
          shared answer and the work is naming libraries per site. The library earns its place for "choose a piece" (a thread or an artwork), where it already works as a chooser in Channel.
        </li>
      </ul>

      <h2>What exists today</h2>
      <div className="pkr-scroll">
        <table className="pkr-table">
          <thead>
            <tr>
              <th>Piece</th>
              <th>Where</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            {EXISTS.map((t) => (
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

      <h2>How a setting opens a picker</h2>
      <ol>
        <li>
          A block declares a setting with <code>binds</code> naming what it points at (gathering, person, place, artwork and so on), or declares it as an image.
        </li>
        <li>
          <strong>In Puck:</strong> the editor's config chooses a control from that. Images get the picture picker. Other kinds get a picker only if the site claims them (siteBindsFields, or a field of its own like
          sunjay's); an unclaimed kind is a plain text box, except an Opens setting, which draws no field at all when the site has not claimed it (packages/page-builder/src/config.client.tsx:156-170).
        </li>
        <li>
          <strong>In the canvas:</strong> if the site's records source handles that kind, the setting appears with a Choose button that opens the "From what?" drawer. If it does not, the setting stays a text box
          (packages/direct-edit/src/canvas/tree-editor.ts:154, :1395).
        </li>
        <li>The page stores only the reference. What it draws is looked up when the page is drawn, never copied into the page.</li>
      </ol>

      <h2>The blocks Justin named</h2>
      <div className="pkr-scroll">
        <table className="pkr-table">
          <thead>
            <tr>
              <th>Block</th>
              <th>Setting</th>
              <th>Picker today</th>
            </tr>
          </thead>
          <tbody>
            {BLOCKS.map((b) => (
              <tr key={b.block}>
                <td>{b.block}</td>
                <td>{b.setting}</td>
                <td>{b.today}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Questions for the later session</h2>
      <ol className="pkr-open">
        {OPEN.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ol>
    </div>
  );
}

const idea: Idea = {
  slug: "pickers-in-puck",
  title: "Pickers in Puck: media, thread, user",
  summary: "Could the content library, or the pickers other apps already have, open as the chooser inside the Puck studio? What exists, what is missing, and an honest answer.",
  status: "exploring",
  added: "2026-11-21",
  refs: [
    "packages/page-builder/src/fields/record-fields.tsx",
    "packages/page-builder/src/fields/record-sources.ts",
    "packages/cms-ui/src/files",
    "apps/elktours/src/lib/media-libraries.ts",
    "docs/open/CONTENT_LIBRARY_COMPONENT_2026-11-08.md",
    "packages/content",
  ],
  Component: PickersInPuck,
};

export default idea;

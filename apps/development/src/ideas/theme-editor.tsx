import Link from "next/link";
import type { Idea } from "./types";

// A short page about the idea, with a way in. The working thing lives at /themes.
const idea: Idea = {
  slug: "theme-editor-site-preview",
  title: "Theme editor with site preview",
  summary: "Change a site's colours, fonts and corners and watch a mock of that site re-skin: its own header and footer around the blocks it really uses, in page order, on desktop or phone, side by side with another theme.",
  status: "building",
  added: "2026-11-20",
  refs: ["apps/development/src/components/themes", "apps/development/scripts/site-pages.seed.json", "packages/direct-edit/src/site (Site style)"],
  Component: function ThemeEditorIdea() {
    return (
      <div style={{ maxWidth: 680, lineHeight: 1.6 }}>
        <p>
          A theme is only judged on a page. So the editor sits beside a mock of the site: its header and footer as the site draws them, and between them the blocks that site actually uses, in the order it uses
          them on its Home page and a few others. Move a colour and the whole page moves.
        </p>
        <ul>
          <li>Pick a site. Controls are grouped in plain words (the site&apos;s own Site style labels, or its palette roles), with every other variable under &ldquo;All variables&rdquo;.</li>
          <li>Everything is a sandbox draft. Export copies the changed values as JSON or CSS; Reset goes back to the site&apos;s own.</li>
          <li>Compare puts the same page under two themes side by side: the site as it is, your draft, or another theme such as the test theme.</li>
          <li>Adding a site is a data entry: its pages, stylesheets and header/footer markup in the seed file, then two refresh scripts.</li>
        </ul>
        <p>
          <Link href="/themes">Open the theme editor</Link>
        </p>
      </div>
    );
  },
};

export default idea;

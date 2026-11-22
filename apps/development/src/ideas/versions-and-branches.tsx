import type { Idea } from "./types";

// A plain page: the model in a paragraph, then how it would extend to real pages and what the
// owner has to decide. Metadata is exported as the idea; no client code needed.

const box = { maxWidth: 760, lineHeight: 1.55, fontSize: 14, color: "var(--dev-ink)" } as const;
const h = { margin: "22px 0 6px", fontSize: 15, color: "var(--dev-ink)" } as const;
const muted = { color: "var(--dev-muted)" } as const;

function VersionsAndBranches() {
  return (
    <div style={box}>
      <h3 style={h}>The model</h3>
      <p>
        Every time you press <strong>Save version</strong> in the sandbox, the block is stored exactly as it is: its settings, its looks and the theme you were previewing, with an optional note and the time. Nothing is ever overwritten. Each version remembers which version it was made from. If you go back to an earlier version and save from there, the earlier version already has a later one, so a <strong>branch</strong> starts (you name it, or it is called &ldquo;Try 2&rdquo;), and the first line of work carries on untouched. Between saves, a <strong>working copy</strong> is saved automatically every couple of seconds, so closing the window loses nothing; it is the one thing that is overwritten, and saving a version clears it. <strong>History</strong> shows each branch as a lane with a picture and note per version; you can look at one, compare two (side by side or with a slider), continue from any of them, and <strong>keep</strong> your favourite.
      </p>
      <h3 style={h}>Where it is stored</h3>
      <p style={muted}>
        One table, <code>dev_versions</code> (migration 281, written but not yet applied). A row is a version or a working copy, with <code>subject</code> (a plain key, <code>block:&lt;app&gt;:&lt;id&gt;</code> today), <code>parent_id</code>, <code>branch</code>, <code>note</code>, <code>doc</code> (the one-block Puck data), <code>theme</code>, <code>author_id</code> and <code>kept</code>. Until the table exists the sandbox says &ldquo;Versions are not set up yet&rdquo; and everything else works.
      </p>
      <h3 style={h}>How it would reach real site pages</h3>
      <p>
        The table does not know about blocks: a page is just another subject, <code>page:&lt;org&gt;:&lt;slug&gt;</code>, and its <code>doc</code> is the page&apos;s Puck data instead of a one-block one. Two ways to get there. <strong>(a) The same table as a page history:</strong> the editor&apos;s Publish also writes a version (the live page stays in <code>site_config</code> as <code>puck:&lt;slug&gt;</code>; versions are a side record), and the working copy replaces the proposed <code>puckdraft:&lt;slug&gt;</code> key, so a draft is not a second place a page can live. <strong>(b) A <code>page_revisions</code> table</strong> shaped for pages only, with an org column and row-level security per site. (a) gives one History screen for blocks and pages and a branch can be tried on a copy of the page; (b) is tighter for tenancy but means building the screen twice. The landing loft&apos;s &ldquo;Put on the page / Go back&rdquo; maps onto this: Put on the page = publish the chosen version; Go back = continue from an older one. Page-builder&apos;s <code>expectedUpdatedAt</code> check should compare against the version the editor started from, so two people cannot silently overwrite each other.
      </p>
      <h3 style={h}>What has to be decided</h3>
      <ol>
        <li>Apply migration 281 (the sandbox is useful only when it is applied).</li>
        <li>For real pages: one shared table (a) or a separate page_revisions table (b)? This ideas page recommends (a) with an org column added when pages arrive.</li>
        <li>Who may see versions of a site page: network admins only (as now), or each site&apos;s own editors too?</li>
        <li>How long to keep versions: forever (today), or thin out old ones that are not kept and not a branch tip.</li>
        <li>Whether publishing a page should itself create a version automatically (recommended), so &ldquo;Go back&rdquo; always has something to go back to.</li>
      </ol>
    </div>
  );
}

const idea: Idea = {
  slug: "versions-and-branches",
  title: "Versions and branches",
  summary: "Every saved edit of a block is a version that is never overwritten. Saving from an older version starts a branch. History lets you look, compare, continue and keep the favourite.",
  status: "building",
  added: "2026-11-20",
  refs: ["packages/db/migrations/281_dev_versions.sql", "apps/development/src/lib/versions.ts", "docs/open/HOUSE_EDITOR_ONE_2026-11-20/PLAN.md (H4 drafts)", "apps/art-auction/src/lib/landing-loft.ts"],
  Component: VersionsAndBranches,
};

export default idea;

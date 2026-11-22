import type { Idea } from "./types";

function FreePlacement() {
  return (
    <>
      <p className="dev-lede">
        Place any box or part exactly where you want it, on top of the layout it already sits in. It lives in the canvas that opens from a block&apos;s
        &ldquo;Edit look&rdquo; (the popup), as a tool beside the pointer.
      </p>

      <h2>How to use it</h2>
      <ol>
        <li>Open a block in the sandbox (Blocks, then Edit), select a part in the preview and press Edit look. The canvas opens.</li>
        <li>
          In the bar at the top left, next to the pointer, press the four-arrow tool (or the M key). The pointer is for choosing, this one is for placing. The
          hand stays for moving around the page.
        </li>
        <li>
          Drag any box or part. It follows the pointer in both directions. A pink line shows when an edge or the middle lines up with a neighbour or the box
          around it; otherwise it falls on a light 8 px grid. Hold Alt to turn snapping off, Shift to keep to one direction, Esc to put it back mid-drag.
        </li>
        <li>
          With a box selected the arrow keys nudge it by 1 px, Shift and an arrow by 10. The right panel (Size) shows Free X and Free Y as you move, and you can type
          numbers there.
        </li>
        <li>&ldquo;Reset position&rdquo; (in the panel, or by right-clicking the box) takes it back to where the layout puts it. Undo works as always.</li>
        <li>Use on this page hands the result back to the sandbox like any other look change.</li>
      </ol>

      <h2>What it stores</h2>
      <p>
        Two numbers on the box&apos;s look, <code>fx</code> and <code>fy</code> (pixels, between -1200 and 1200), written the same way as the other look values and
        cleaned with them. They are drawn as the CSS <code>translate</code> property, so the rest of the layout does not move or reflow: a box is only shifted
        visually from its place. Delete the two numbers and the page is exactly what it was. Pixels, not percent, because a percent of the box itself is not
        what anyone means by &ldquo;a bit to the right&rdquo;.
      </p>

      <h2>Phones</h2>
      <p>
        Free placement is drawn from 768 px wide upward. Below that the offsets are ignored and the normal flow layout is used, so a hand-placed desktop page can
        never push a word off a phone screen. A separate phone placement is the obvious next step and is not built.
      </p>

      <h2>Limits</h2>
      <ul>
        <li>It only moves things visually. A box stays in the same place in the reading order and keeps its slot in the layout (its old space stays empty).</li>
        <li>Moved boxes can overlap each other and what is behind them; nothing stops that.</li>
        <li>Off by default everywhere. Only this app turns it on (<code>freeMove</code> on the popup, <code>flags.freeMove</code> on the house editor).</li>
        <li>Not resizing, rotating or grouping: those exist in the panel already (Effects) but are not part of this tool.</li>
      </ul>
    </>
  );
}

const idea: Idea = {
  slug: "free-placement",
  title: "Free placement (x and y)",
  summary: "A Free move tool beside the pointer in the canvas: drag any box or part anywhere, with guides, a light grid and typed x and y.",
  status: "building",
  added: "2026-11-20",
  refs: ["packages/direct-edit/src/canvas/free-move.ts", "packages/direct-edit/src/block/style.ts (fx, fy)", "packages/house-editor (flags.freeMove)"],
  Component: FreePlacement,
};

export default idea;

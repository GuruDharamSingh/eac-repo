/**
 * "Edit this page's layout" on a page drawn from a record (round 2, 2026-11-14): a post, a gathering or a piece.
 * Opens the canvas on the template that draws every page of that kind, on THIS record (`?thread=` / `?piece=`,
 * app/studio/[slug]/record.ts), so the editor shows what the visitor sees. Editors only: the caller decides, and the
 * studio route checks the role again. Before the template is published the page keeps its plain layout, so the
 * door says what it starts.
 */
export function LayoutDoor({
  template,
  thread,
  piece,
  published,
}: {
  template: "post-detail" | "event-detail" | "journal-piece";
  thread?: string;
  piece?: string;
  /** The template has a stored document. Default true. */
  published?: boolean;
}) {
  const q = new URLSearchParams();
  if (thread) q.set("thread", thread);
  if (piece) q.set("piece", piece);
  const s = q.toString();
  return (
    <a
      href={`/studio/${template}${s ? `?${s}` : ""}`}
      title="One layout draws every page of this kind: a change there changes all of them."
      className="border border-input bg-background px-3 py-1.5 text-sm hover:border-[hsl(var(--primary))]"
    >
      {published === false ? "Design a layout for pages like this" : "Edit this page's layout"}
    </a>
  );
}

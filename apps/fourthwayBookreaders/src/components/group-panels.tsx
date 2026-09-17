import Link from "next/link";
import { PlayCircle } from "lucide-react";
import type { SessionNote, Thread } from "@/lib/types";
import { addSessionNote, setGroupPage } from "@/lib/manage-actions";
import { formatDay } from "@/lib/format";

/** What the group's sittings have left behind. Empty is a normal state, not an error. */
export function SessionList({ notes }: { notes: SessionNote[] }) {
  return (
    <section className="band">
      <div className="band__head"><h2 className="band__title">Sittings so far</h2></div>
      {notes.length === 0 ? (
        <div className="empty">Nothing recorded yet. A sitting appears here once someone writes it up.</div>
      ) : (
        <ul className="booklist">
          {notes.map((n) => (
            <li key={n.id}>
              <Link href={n.href}>
                <span className="booklist__author" style={{ minWidth: 110 }}>
                  {n.heldOn ? formatDay(new Date(`${n.heldOn}T12:00:00Z`)) : "undated"}
                </span>
                <span className="booklist__title">
                  {n.pagesFrom != null && n.pagesTo != null
                    ? `Pages ${n.pagesFrom}–${n.pagesTo}`
                    : n.pagesTo != null ? `To page ${n.pagesTo}` : "Notes"}
                </span>
                {n.recordingUrl && <span className="booklist__author"><PlayCircle size={12} aria-hidden /> recorded</span>}
                {n.excerpt && <span className="booklist__note">{n.excerpt}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Editors only: move the bookmark, write up a sitting. Both are plain server-action forms. */
export function GroupEditorPanel({ group, empty }: { group: Thread; empty: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <section className="band">
      <div className="band__head">
        <h2 className="band__title">Keep the group</h2>
        <span className="eyebrow">editors only</span>
      </div>
      <div className="split">
        <form action={setGroupPage} className="card" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <input type="hidden" name="groupId" value={group.id} />
          <label>
            <span className="eyebrow">The page this group is on</span>
            <input name="currentPage" type="number" min={1} required className="field" defaultValue={group.currentPage ?? ""} />
          </label>
          <div><button className="btn">Move the bookmark</button></div>
        </form>

        <form action={addSessionNote} className="card" style={{ display: "grid", gap: 12 }}>
          <input type="hidden" name="groupId" value={group.id} />
          <p className="card__title" style={{ margin: 0 }}>Record a sitting</p>
          {empty && <p className="eyebrow" style={{ color: "var(--crimson)" }}>Give it notes, pages, or a recording.</p>}
          <label><span className="eyebrow">Held on</span><input name="heldOn" type="date" className="field" defaultValue={today} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label><span className="eyebrow">From page</span><input name="pagesFrom" type="number" min={1} className="field" defaultValue={group.currentPage ?? ""} /></label>
            <label><span className="eyebrow">To page</span><input name="pagesTo" type="number" min={1} className="field" /></label>
          </div>
          <label><span className="eyebrow">What was heard</span><textarea name="notes" rows={4} className="field" /></label>
          <label>
            <span className="eyebrow">Recording (optional)</span>
            <input name="recordingUrl" className="field" placeholder="/api/media/… or https://…" />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.92rem" }}>
            <input type="checkbox" name="moveBookmark" defaultChecked /> Move the bookmark to the last page read
          </label>
          <div><button className="btn btn--primary">Add to the archive</button></div>
        </form>
      </div>
    </section>
  );
}

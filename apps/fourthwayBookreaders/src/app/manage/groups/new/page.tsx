import type { Metadata } from "next";
import { createReadingGroup } from "@/lib/manage-actions";
import { getSiteSections, readCurrentBook } from "@/lib/data";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "New reading group" };

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  // A new group most likely reads the site's lead book; it can read another.
  const book = readCurrentBook(await getSiteSections());
  return (
    <>
      <h1 style={{ fontSize: "1.6rem" }}>New reading group</h1>
      <p style={{ margin: "8px 0 20px", maxWidth: "64ch", color: "var(--ink-muted)" }}>
        A group is the people reading a book together over a stretch of time — not one evening of it.
        Give it a cadence and, if it has one, an end. People join it once; each sitting is recorded
        afterwards from the group&rsquo;s own page. Times are {siteConfig.timeZone}.
      </p>
      {error === "title" && <p className="eyebrow" style={{ color: "var(--crimson)" }}>Give it a name.</p>}
      <form action={createReadingGroup} className="card" style={{ display: "grid", gap: 16, maxWidth: 640 }}>
        <label><span className="eyebrow">Name of the group</span><input name="title" required minLength={3} className="field" placeholder="Thursday circle" /></label>
        <label><span className="eyebrow">What to expect</span><textarea name="body" rows={4} className="field" /></label>

        <div className="split" style={{ gap: 16 }}>
          <label><span className="eyebrow">Book</span><input name="bookTitle" className="field" defaultValue={book?.title ?? ""} /></label>
          <label><span className="eyebrow">Author</span><input name="bookAuthor" className="field" defaultValue={book?.author ?? ""} /></label>
        </div>
        <label style={{ maxWidth: 220 }}><span className="eyebrow">Starting at page</span><input name="currentPage" type="number" min={1} className="field" defaultValue={1} /></label>

        <div className="split" style={{ gap: 16 }}>
          <label><span className="eyebrow">First sitting</span><input name="scheduledAt" type="datetime-local" required className="field" /></label>
          <label><span className="eyebrow">Minutes</span><input name="durationMinutes" type="number" min={15} defaultValue={90} className="field" /></label>
        </div>
        <div className="split" style={{ gap: 16 }}>
          <label>
            <span className="eyebrow">Sits</span>
            <select name="recurrence" className="field" defaultValue="WEEKLY">
              <option value="WEEKLY">Every week</option>
              <option value="MONTHLY">Every month</option>
              <option value="DAILY">Every day</option>
              <option value="">Once only</option>
            </select>
          </label>
          <label><span className="eyebrow">Runs until (optional)</span><input name="endsOn" type="date" className="field" /></label>
        </div>

        <label><span className="eyebrow">Where</span><input name="location" className="field" placeholder="left empty for online only" /></label>
        <label><span className="eyebrow">Video call link</span><input name="meetingUrl" type="url" className="field" placeholder="https://…" /></label>
        <div className="split" style={{ gap: 16 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="rsvp" defaultChecked /> People can join from the site</label>
          <label><span className="eyebrow">Seats (optional)</span><input name="attendeeLimit" type="number" min={1} className="field" /></label>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn--primary">Start the group</button>
          <button className="btn" name="draft" value="1">Save as draft</button>
        </div>
      </form>
    </>
  );
}

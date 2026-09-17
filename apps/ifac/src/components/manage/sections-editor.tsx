"use client";

import { useMemo, useState } from "react";
import type { IfacSiteContent, PublicEvent } from "@/lib/types";
import { siteConfig } from "@/config/site";

/**
 * Site copy and events — the half of the old /admin dashboard that was actually
 * about content rather than people.
 *
 * The section editor is still raw JSON. That is a deliberate holding position,
 * not an oversight: each of these eleven sections has its own shape, and the
 * network's answer to editing them properly is the template/manifest field
 * substrate, not eleven hand-written forms here. What it gained is a per-section
 * note saying what the shape is, and a JSON check that names the problem before
 * a save can flatten the section.
 */

const sectionLabels: Record<keyof IfacSiteContent, string> = {
  hero: "Hero",
  about: "About",
  signup: "Sign-up copy",
  rsvp: "RSVP copy",
  gallery: "Gallery",
  dealers: "Art dealers",
  blog: "Blog",
  videos: "Videos",
  social: "Social links",
  embeds: "Embed notes",
  footer: "Footer",
};

export function SectionsEditor({
  initialContent,
  initialEvents,
}: {
  initialContent: IfacSiteContent;
  initialEvents: PublicEvent[];
}) {
  const [content, setContent] = useState(initialContent);
  const [events, setEvents] = useState(initialEvents);
  const [section, setSection] = useState<keyof IfacSiteContent>("hero");
  const [sectionText, setSectionText] = useState(JSON.stringify(initialContent.hero, null, 2));
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const rsvpTotal = useMemo(
    () => events.reduce((total, event) => total + Number(event.rsvp_count || 0), 0),
    [events]
  );

  /** The keys this section already has, as a hint about the shape a save wants. */
  const knownKeys = useMemo(() => {
    const value = content[section];
    return value && typeof value === "object" ? Object.keys(value) : [];
  }, [content, section]);

  function changeSection(value: keyof IfacSiteContent) {
    setSection(value);
    setSectionText(JSON.stringify(content[value], null, 2));
    setNotice("");
  }

  async function saveSection() {
    setNotice("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(sectionText);
    } catch (error) {
      // The parser's own message names the line — far more use than "not valid".
      setNotice(`That isn't valid JSON: ${error instanceof Error ? error.message : "check the braces and commas."}`);
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setNotice("A section has to be a JSON object — { \"key\": \"value\" }.");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/manage/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionKey: section, content: parsed }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setNotice(data.error || "Save failed.");
      return;
    }
    setContent((current) => ({ ...current, [section]: parsed } as IfacSiteContent));
    setNotice(`${sectionLabels[section]} saved. The public page shows it now.`);
  }

  async function createEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch("/api/manage/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(data.error || "Could not create event.");
      return;
    }
    setEvents(data.events || []);
    form.reset();
    setNotice("Event created.");
  }

  return (
    <>
      <div className="stats-grid" style={{ marginTop: 0, marginBottom: "1rem" }}>
        <div className="stat-tile">
          <span>
            <strong>{events.length}</strong> upcoming events
          </span>
        </div>
        <div className="stat-tile">
          <span>
            <strong>{rsvpTotal}</strong> RSVPs across them
          </span>
        </div>
        <div className="stat-tile">
          <span>
            <strong>{Object.keys(sectionLabels).length}</strong> editable site areas
          </span>
        </div>
      </div>

      <div className="admin-grid">
        <section className="admin-panel">
          <h2>Edit one site area</h2>
          <p className="small-note">
            Each area saves on its own into <code>org_site_sections</code> for org{" "}
            <code>{siteConfig.orgId}</code>. Only the area you pick is written — the
            others are left exactly as they are.
          </p>
          <div className="section-editor">
            <div className="field">
              <label htmlFor="section-key">Area</label>
              <select
                id="section-key"
                value={section}
                onChange={(event) => changeSection(event.currentTarget.value as keyof IfacSiteContent)}
              >
                {(Object.keys(sectionLabels) as Array<keyof IfacSiteContent>).map((key) => (
                  <option key={key} value={key}>
                    {sectionLabels[key]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="section-json">Content JSON</label>
              <textarea
                id="section-json"
                value={sectionText}
                onChange={(event) => setSectionText(event.currentTarget.value)}
                spellCheck={false}
              />
              {knownKeys.length > 0 && (
                <p className="small-note">
                  This area uses: {knownKeys.map((k) => <code key={k}>{k} </code>)}
                </p>
              )}
            </div>
            <button className="button" type="button" onClick={saveSection} disabled={saving}>
              {saving ? "Saving…" : "Save area"}
            </button>
            <div className="form-status" aria-live="polite">
              {notice}
            </div>
          </div>
        </section>

        <section className="admin-panel">
          <h2>Events &amp; RSVPs</h2>
          <p className="small-note">
            A published event with RSVPs open. It appears on the home page and in the
            hub calendar straight away.
          </p>
          <form className="form-shell" onSubmit={createEvent} style={{ padding: "0.75rem" }}>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="title">Title</label>
                <input id="title" name="title" required />
              </div>
              <div className="field">
                <label htmlFor="scheduled_at">Date and time</label>
                <input id="scheduled_at" name="scheduled_at" type="datetime-local" />
              </div>
            </div>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="location">Location</label>
                <input id="location" name="location" placeholder="Online, gallery, city" />
              </div>
              <div className="field">
                <label htmlFor="attendee_limit">Capacity</label>
                <input id="attendee_limit" name="attendee_limit" type="number" min="1" placeholder="80" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="body">Description</label>
              <textarea id="body" name="body" />
            </div>
            <button className="button" type="submit">
              Create event
            </button>
          </form>

          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Location</th>
                  <th>RSVPs</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{event.title}</td>
                    <td>{event.location || "TBA"}</td>
                    <td>{event.rsvp_count}</td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={3} className="small-note">
                      Nothing scheduled.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

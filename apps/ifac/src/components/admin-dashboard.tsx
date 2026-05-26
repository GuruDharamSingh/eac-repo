"use client";

import { useMemo, useState } from "react";
import type { IfacContact, IfacSiteContent, IfacUser, PublicEvent } from "@/lib/types";
import { siteConfig } from "@/config/site";

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

export function AdminDashboard({
  initialContent,
  initialEvents,
  initialContacts,
  initialUsers,
  userEmail,
}: {
  initialContent: IfacSiteContent;
  initialEvents: PublicEvent[];
  initialContacts: IfacContact[];
  initialUsers: IfacUser[];
  userEmail: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [events, setEvents] = useState(initialEvents);
  const [contacts, setContacts] = useState(initialContacts);
  const [users, setUsers] = useState(initialUsers);
  const [section, setSection] = useState<keyof IfacSiteContent>("hero");
  const [sectionText, setSectionText] = useState(JSON.stringify(initialContent.hero, null, 2));
  const [notice, setNotice] = useState("");
  const [eventTitle, setEventTitle] = useState("");

  const rsvpTotal = useMemo(
    () => events.reduce((total, event) => total + Number(event.rsvp_count || 0), 0),
    [events]
  );

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
    } catch {
      setNotice("The section JSON is not valid.");
      return;
    }

    const response = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionKey: section, content: parsed }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(data.error || "Save failed.");
      return;
    }
    setContent((current) => ({ ...current, [section]: parsed } as IfacSiteContent));
    setNotice(`${sectionLabels[section]} saved.`);
  }

  async function createEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch("/api/admin/events", {
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
    setEventTitle("");
    form.reset();
    setNotice("Event created.");
  }

  async function refreshUsers() {
    const response = await fetch("/api/admin/users");
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setUsers(data.users || []);
      setContacts(data.contacts || []);
    }
  }

  async function updateRole(userId: string, role: string) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    if (response.ok) refreshUsers();
  }

  return (
    <div className="admin-shell">
      <div className="page-heading">
        <p className="kicker">IFAC admin</p>
        <h1>Section editor and user management</h1>
        <p className="body-copy">Signed in as {userEmail}</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: "1rem" }}>
        <div className="stat-tile">{contacts.length} recent contacts</div>
        <div className="stat-tile">{users.length} IFAC users</div>
        <div className="stat-tile">{rsvpTotal} event RSVPs</div>
      </div>

      <div className="admin-grid">
        <section className="admin-panel">
          <h2>Edit one site area</h2>
          <p className="small-note">Each area saves independently into `org_site_sections` for org `{siteConfig.orgId}`.</p>
          <div className="section-editor">
            <div className="field">
              <label htmlFor="section-key">Area</label>
              <select id="section-key" value={section} onChange={(event) => changeSection(event.currentTarget.value as keyof IfacSiteContent)}>
                {(Object.keys(sectionLabels) as Array<keyof IfacSiteContent>).map((key) => (
                  <option key={key} value={key}>{sectionLabels[key]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="section-json">Content JSON</label>
              <textarea id="section-json" value={sectionText} onChange={(event) => setSectionText(event.currentTarget.value)} />
            </div>
            <button className="button" type="button" onClick={saveSection}>Save area</button>
            <div className="form-status" aria-live="polite">{notice}</div>
          </div>
        </section>

        <section className="admin-panel">
          <h2>Events and RSVP backend</h2>
          <form className="form-shell" onSubmit={createEvent}>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="title">Title</label>
                <input id="title" name="title" value={eventTitle} onChange={(event) => setEventTitle(event.currentTarget.value)} required />
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
            <button className="button" type="submit">Create event</button>
          </form>

          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table>
              <thead>
                <tr><th>Event</th><th>Location</th><th>RSVPs</th></tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{event.title}</td>
                    <td>{event.location || "TBA"}</td>
                    <td>{event.rsvp_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="admin-grid" style={{ marginTop: "1rem" }}>
        <section className="table-panel">
          <h2>User management</h2>
          <p className="small-note">IFAC-specific roles reuse the central `users` and `user_organizations` tables. Full network tools remain in central admin.</p>
          <p><a className="button-secondary" href={`${siteConfig.centralAdminUrl}/users`}>Open central user admin</a></p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>User</th><th>Role</th><th>Change role</th></tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.display_name || user.email}<br /><span className="small-note">{user.email}</span></td>
                    <td>{user.role || "member"}</td>
                    <td>
                      <select defaultValue={user.role || "member"} onChange={(event) => updateRole(user.id, event.currentTarget.value)}>
                        <option value="viewer">Viewer</option>
                        <option value="member">Member</option>
                        <option value="guide">Guide</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {users.length === 0 ? <tr><td colSpan={3}>No IFAC users yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="table-panel">
          <h2>Contacts and sign-ups</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Source</th><th>Message</th></tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>{contact.name || "Visitor"}</td>
                    <td>{contact.email}</td>
                    <td>{contact.source || "site"}</td>
                    <td>{contact.message || ""}</td>
                  </tr>
                ))}
                {contacts.length === 0 ? <tr><td colSpan={4}>No sign-ups yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

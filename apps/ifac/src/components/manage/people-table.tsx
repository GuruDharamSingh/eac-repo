"use client";

import { useMemo, useState } from "react";
import type { ManageContact, ManageMember } from "@/lib/manage";

/**
 * People & access.
 *
 * Each row offers three independent things, which is the whole point of the
 * screen — they used to be confused with each other:
 *
 *   Listing  "Take off the page" / "Put on the page". Hides them from the
 *            public roster. Their account, bio and portfolio are untouched, and
 *            one click puts them back.
 *   Access   viewer / member / guide. What they may do inside IFAC.
 *   Remove   Takes them out of IFAC entirely. Still not an account deletion:
 *            the `users` row is network-wide, so it survives.
 *
 * An owner's row carries no controls, and neither does your own — see the
 * guard in lib/manage.ts for why.
 */

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  guide: "Guide",
  member: "Member",
  viewer: "Viewer (follower)",
};

const ROLE_HINTS: Record<string, string> = {
  guide: "Can edit and publish IFAC content, and manage this console.",
  member: "Can take part — post, RSVP, use the hub.",
  viewer: "Read-only follower. Cannot see members-only pages.",
};

export function PeopleTable({
  initialMembers,
  initialContacts,
  viewerUserId,
  centralAdminUrl,
}: {
  initialMembers: ManageMember[];
  initialContacts: ManageContact[];
  viewerUserId: string;
  centralAdminUrl: string;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [contacts, setContacts] = useState(initialContacts);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const listedCount = useMemo(
    () => members.filter((m) => m.listing?.isPublic).length,
    [members]
  );

  /** Every write returns the whole refreshed screen — see the API route. */
  async function send(
    member: ManageMember,
    init: RequestInit,
    query = "",
    success = ""
  ) {
    setBusyId(member.userId);
    setNotice("");
    try {
      const res = await fetch(`/api/manage/people${query}`, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error || "That didn't work.");
        return;
      }
      if (data.members) setMembers(data.members);
      if (data.contacts) setContacts(data.contacts);
      if (success) setNotice(success);
    } finally {
      setBusyId(null);
    }
  }

  function changeRole(member: ManageMember, role: string) {
    const name = member.displayName || member.email;
    void send(
      member,
      {
        method: "PATCH",
        body: JSON.stringify({ userId: member.userId, role }),
      },
      "",
      `${name} is now a ${ROLE_LABELS[role]?.toLowerCase() ?? role}.`
    );
  }

  function setListed(member: ManageMember, listed: boolean) {
    const name = member.displayName || member.email;
    void send(
      member,
      {
        method: "PATCH",
        body: JSON.stringify({ userId: member.userId, listed, slug: member.listing?.slug }),
      },
      "",
      listed ? `${name} is back on the site.` : `${name} is no longer listed on the site.`
    );
  }

  function remove(member: ManageMember) {
    const name = member.displayName || member.email;
    if (
      !confirm(
        `Remove ${name} from IFAC?\n\nThey lose access here and come off the public roster. ` +
          `Their account and their own content are not deleted, and you can add them back.`
      )
    ) {
      return;
    }
    const params = new URLSearchParams({ userId: member.userId });
    if (member.listing?.slug) params.set("slug", member.listing.slug);
    void send(member, { method: "DELETE" }, `?${params.toString()}`, `${name} removed from IFAC.`);
  }

  return (
    <>
      <div className="stats-grid" style={{ marginTop: 0, marginBottom: "1rem" }}>
        <div className="stat-tile">
          <span>
            <strong>{members.length}</strong> people in IFAC
          </span>
        </div>
        <div className="stat-tile">
          <span>
            <strong>{listedCount}</strong> shown on the public site
          </span>
        </div>
        <div className="stat-tile">
          <span>
            <strong>{contacts.length}</strong> contacts &amp; sign-ups
          </span>
        </div>
      </div>

      <section className="table-panel">
        <h2>Members</h2>
        <p className="small-note">
          Three separate things, three separate columns. <strong>Listing</strong> is
          whether the public site shows them at all. <strong>Access</strong> is what
          they may do inside IFAC — it reuses the network&apos;s shared roles, so the
          same words mean the same thing in every org. Neither is the public byline
          under their name; that&apos;s the Display title field on{" "}
          <a href="/manage/directory">Artists &amp; dealers</a>.
        </p>
        <p className="manage-note">
          Nothing here deletes an account. A person&apos;s record is shared across the
          whole network — the same row can be an IFAC artist, an ArtDirect profile and
          a seller in the marketplace — so removing them here drops their IFAC
          membership and their listing, and leaves the person intact. Deleting an
          account outright is a{" "}
          <a href={`${centralAdminUrl}/users`}>central admin</a> job.
        </p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Listing</th>
                <th>Access</th>
                <th>Change access</th>
                <th>Membership</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isSelf = member.userId === viewerUserId;
                const isOwner = member.role === "owner";
                // An owner's access, and your own, are not changeable here.
                const locked = isSelf || isOwner;
                const busy = busyId === member.userId;

                return (
                  <tr key={member.userId}>
                    <td>
                      {member.displayName || member.email}
                      {isSelf && <span className="small-note"> (you)</span>}
                      <br />
                      <span className="small-note">{member.email}</span>
                      {member.isAdmin && (
                        <>
                          <br />
                          <span className="manage-flag" data-tone="alert">
                            Network admin
                          </span>
                        </>
                      )}
                    </td>

                    <td>
                      {member.listing === null ? (
                        <span className="manage-flag" data-tone="none">
                          No profile
                        </span>
                      ) : member.listing.isPublic ? (
                        <>
                          <span className="manage-flag" data-tone="live">
                            On the site
                          </span>
                          <div className="manage-row-actions" style={{ marginTop: "0.4rem" }}>
                            <button
                              className="button-secondary"
                              type="button"
                              disabled={busy}
                              onClick={() => setListed(member, false)}
                            >
                              Take off the page
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="manage-flag" data-tone="hidden">
                            Hidden
                          </span>
                          <div className="manage-row-actions" style={{ marginTop: "0.4rem" }}>
                            <button
                              className="button-secondary"
                              type="button"
                              disabled={busy}
                              onClick={() => setListed(member, true)}
                            >
                              Put on the page
                            </button>
                          </div>
                        </>
                      )}
                    </td>

                    <td>
                      {ROLE_LABELS[member.role] ?? member.role}
                      {ROLE_HINTS[member.role] && (
                        <>
                          <br />
                          <span className="small-note">{ROLE_HINTS[member.role]}</span>
                        </>
                      )}
                    </td>

                    <td>
                      {locked ? (
                        <span className="small-note">
                          {isSelf
                            ? "You can't change your own access."
                            : "Owners are changed in central admin."}
                        </span>
                      ) : (
                        <div className="manage-row-actions">
                          <select
                            value={member.role}
                            disabled={busy}
                            aria-label={`Access role for ${member.displayName || member.email}`}
                            onChange={(event) => changeRole(member, event.currentTarget.value)}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="member">Member</option>
                            <option value="guide">Guide</option>
                          </select>
                        </div>
                      )}
                    </td>

                    <td>
                      {locked ? (
                        <span className="small-note">—</span>
                      ) : (
                        <div className="manage-row-actions">
                          <button
                            className="button-secondary manage-danger"
                            type="button"
                            disabled={busy}
                            onClick={() => remove(member)}
                          >
                            Remove from IFAC
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr>
                  <td colSpan={5} className="small-note">
                    Nobody has signed up to IFAC yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="form-status" aria-live="polite">
          {notice}
        </div>
      </section>

      <section className="table-panel" style={{ marginTop: "1rem" }}>
        <h2>Contacts &amp; sign-ups</h2>
        <p className="small-note">
          People who wrote in or asked to hear more. These are not accounts and have
          no access to anything.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Source</th>
                <th>Message</th>
              </tr>
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
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={4} className="small-note">
                    No sign-ups yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

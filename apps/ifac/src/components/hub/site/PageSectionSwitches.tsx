"use client";

import * as React from "react";
import { marketplaceLinks, storeEntry } from "@elkdonis/commerce/links";
import type { HubSections } from "@/components/hub/PageSectionsCard";

/**
 * "Your page" on the page layout, under the profile card: the sections a
 * member opts into on their public IFAC page (owner, 2026-09-24: "opt into a
 * writing section or store section or gallery section").
 *
 * The same switches as the cards layout's Page sections surface, writing
 * through the same route (PATCH /api/hub/profile-sections). The store switch
 * appears once the member has an active store on art-auction; before that
 * the row is the way to open one.
 */
type Key = "blog" | "store" | "galleries";

export function PageSectionSwitches({
  sections,
  profileHref,
  marketplaceUrl,
}: {
  sections: HubSections;
  profileHref: string | null;
  marketplaceUrl: string;
}) {
  const [on, setOn] = React.useState<Record<Key, boolean>>({
    blog: sections.blog,
    store: sections.store,
    galleries: sections.galleries,
  });
  const [saving, setSaving] = React.useState<Key | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const links = marketplaceLinks(marketplaceUrl, { from: "ifac", handoff: true });
  const entry = storeEntry(links, sections.storeState, {
    storeId: sections.storeId,
    storeName: sections.storeName,
  });
  const storeActive = sections.storeState === "active";

  async function flip(key: Key) {
    const next = !on[key];
    setOn((s) => ({ ...s, [key]: next }));
    setSaving(key);
    setError(null);
    const revert = () => setOn((s) => ({ ...s, [key]: !next }));
    try {
      const res = await fetch("/api/hub/profile-sections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) {
        revert();
        setError((await res.json().catch(() => null))?.error ?? "Could not save that.");
      }
    } catch {
      revert();
      setError("Could not reach the server.");
    } finally {
      setSaving(null);
    }
  }

  const rows: Array<{ key: Key; label: string; note: string }> = [
    { key: "blog", label: "Writing", note: "Your own pieces, on your page" },
    { key: "galleries", label: "Galleries", note: "Your gallery pages" },
  ];

  return (
    <section className="ifac-sections" aria-labelledby="ifac-sections-h">
      <header className="ifac-sections__head">
        <h2 id="ifac-sections-h" className="ifac-sections__title">
          Your page
        </h2>
        {profileHref && (
          <a className="ifac-sections__view" href={profileHref}>
            View it →
          </a>
        )}
      </header>
      <ul className="ifac-sections__list">
        {rows.map((r) => (
          <li key={r.key}>
            <Switch
              label={r.label}
              note={r.note}
              checked={on[r.key]}
              busy={saving === r.key}
              onFlip={() => void flip(r.key)}
            />
          </li>
        ))}
        <li>
          {storeActive ? (
            <Switch
              label="Store"
              note="Your work for sale, from art-auction"
              checked={on.store}
              busy={saving === "store"}
              onFlip={() => void flip("store")}
            />
          ) : (
            <div className="ifac-sections__row">
              <span className="ifac-sections__text">
                <span className="ifac-sections__label">Store</span>
                <span className="ifac-sections__note">{entry.hint}</span>
              </span>
              <a className="ifac-sections__go" href={entry.href}>
                {entry.label}
              </a>
            </div>
          )}
        </li>
      </ul>
      {error && (
        <p className="ifac-sections__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function Switch({
  label,
  note,
  checked,
  busy,
  onFlip,
}: {
  label: string;
  note: string;
  checked: boolean;
  busy: boolean;
  onFlip: () => void;
}) {
  return (
    <label className="ifac-sections__row">
      <span className="ifac-sections__text">
        <span className="ifac-sections__label">{label}</span>
        <span className="ifac-sections__note">{note}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="ifac-sections__switch"
        checked={checked}
        disabled={busy}
        onChange={onFlip}
      />
    </label>
  );
}

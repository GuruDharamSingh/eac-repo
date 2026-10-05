"use client";

import * as React from "react";
import { useSurface } from "../surface";
import type { SurfaceProfileSection } from "../surface/types";

/**
 * "Your page" on a hub's page layout, under the member's card: the optional
 * sections of their public page as switches (owner, 2026-09-24).
 *
 * Reads and writes through the host's `profilePage` connector — the same
 * load/setSection the profile popup's "What shows on your page" tab uses — so
 * the host decides which sections exist, what blocks one (no store yet, no
 * page address) and where each shows. Renders nothing when the host has no
 * such connector or offers no sections.
 */
export function PageSectionSwitches({
  profileHref,
  title = "Your page",
}: {
  profileHref?: string | null;
  title?: string;
}) {
  const { connectors } = useSurface();
  // The host's `profilePage` option lands here (hub/connectors.ts).
  const page = connectors.profile?.page;
  const [sections, setSections] = React.useState<SurfaceProfileSection[] | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const headingId = React.useId();

  React.useEffect(() => {
    if (!page) return;
    let live = true;
    page
      .load()
      .then((r: { sections: SurfaceProfileSection[] }) => live && setSections(r.sections))
      .catch(() => live && setSections([]));
    return () => {
      live = false;
    };
  }, [page]);

  if (!page || (sections !== null && sections.length === 0)) return null;

  async function flip(key: string) {
    const current = sections?.find((s) => s.key === key);
    if (!current || !page) return;
    const next = !current.on;
    const put = (on: boolean) =>
      setSections((list) => list?.map((s) => (s.key === key ? { ...s, on } : s)) ?? list);
    put(next);
    setSaving(key);
    setError(null);
    try {
      const r = await page.setSection(key, next);
      if ("error" in r) {
        put(!next);
        setError(r.error || "Could not save that.");
      }
    } catch {
      put(!next);
      setError("Could not reach the server.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="eac-hs-sections" aria-labelledby={headingId}>
      <header className="eac-hs-sections__head">
        <h2 id={headingId} className="eac-hs-sections__title">
          {title}
        </h2>
        {profileHref && (
          <a className="eac-hs-sections__link" href={profileHref}>
            View it →
          </a>
        )}
      </header>
      {sections === null ? (
        <p className="eac-hs-sections__note">Loading…</p>
      ) : (
        <ul className="eac-hs-sections__list">
          {sections.map((s) => (
            <li key={s.key}>
              {s.blockedReason ? (
                <div className="eac-hs-sections__row is-blocked">
                  <span className="eac-hs-sections__text">
                    <span className="eac-hs-sections__label">{s.label}</span>
                    <span className="eac-hs-sections__note">{s.blockedReason}</span>
                  </span>
                </div>
              ) : (
                <label className="eac-hs-sections__row">
                  <span className="eac-hs-sections__text">
                    <span className="eac-hs-sections__label">{s.label}</span>
                    {s.blurb && <span className="eac-hs-sections__note">{s.blurb}</span>}
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    className="eac-hs-sections__switch"
                    checked={s.on}
                    disabled={saving === s.key}
                    onChange={() => void flip(s.key)}
                  />
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="eac-hs-sections__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

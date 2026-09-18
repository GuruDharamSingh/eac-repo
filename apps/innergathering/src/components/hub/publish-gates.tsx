"use client";

import * as React from "react";
import { SurfaceFrame, useSurface } from "@elkdonis/cms-ui/surface";
import { ArtPieceComposer } from "@elkdonis/cms-ui/compose";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import {
  getBlogStateAction,
  setBlogStateAction,
  type BlogScope,
  type BlogState,
} from "@/lib/cms/blog-actions";
import {
  canListArtPieceAction,
  createArtPieceAction,
} from "@/lib/cms/art-piece-actions";

/**
 * The two publish kinds that are DOORS rather than forms.
 *
 * Both write to a member's own page rather than to the site, so neither is a
 * compose form: the question is "do you want this section, and what should it
 * show", asked once. After that the tile takes them straight there.
 */

const MARKETPLACE_URL =
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ?? "https://art.elkdonis-arts.org";

// ── Blog ────────────────────────────────────────────────────────────────────

export function BlogGate() {
  const surfaces = useSurface();
  const [state, setState] = React.useState<BlogState | null | "loading">("loading");
  const [scope, setScope] = React.useState<BlogScope>("org");
  const [saving, setSaving] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getBlogStateAction()
      .then((s) => {
        if (cancelled) return;
        setState(s);
        if (s) setScope(s.scope);
        // Already on: nothing to ask, so take them there rather than making
        // them confirm a decision they made once.
        if (s?.enabled && s.href) window.location.assign(s.href);
      })
      .catch(() => !cancelled && setState(null));
    return () => {
      cancelled = true;
    };
  }, []);

  async function accept() {
    setSaving(true);
    setProblem(null);
    const result = await setBlogStateAction({ enabled: true, scope });
    setSaving(false);
    if (!result.ok) {
      setProblem(result.error ?? "Could not save that.");
      return;
    }
    surfaces.connectors.onMutated?.();
    if (result.href) window.location.assign(result.href);
  }

  return (
    <SurfaceFrame kind="post" kicker="Publish" title="A blog on your page">
      {state === "loading" ? (
        <p className="eac-rota-empty">One moment…</p>
      ) : !state ? (
        <p className="eac-compose-note">
          You need a member page before you can hang a blog on it. Ask an
          organiser to finish setting up your profile.
        </p>
      ) : !state.href ? (
        <p className="eac-compose-note">
          Your account has no page address yet, so there is nowhere to put a
          blog. An organiser can set one.
        </p>
      ) : (
        <>
          <p className="eac-compose-note">
            Turning this on adds a writing shelf to your member page. Anything
            you publish as writing appears there, newest first.
          </p>

          <fieldset className="eac-field" style={{ border: 0, padding: 0, margin: "14px 0 0" }}>
            <legend className="eac-field-label">What should it show?</legend>
            {/* A real decision, not a setting: the same writing rows are
                authored from every org this person belongs to. */}
            <label className="eac-gate-choice">
              <input
                type="radio"
                name="blog-scope"
                checked={scope === "org"}
                onChange={() => setScope("org")}
              />
              <span>
                <strong>Only what you write here</strong>
                <em>A reader arriving from this site sees this site.</em>
              </span>
            </label>
            <label className="eac-gate-choice">
              <input
                type="radio"
                name="blog-scope"
                checked={scope === "all"}
                onChange={() => setScope("all")}
              />
              <span>
                <strong>Everything you have written</strong>
                <em>Across every group you belong to on the network.</em>
              </span>
            </label>
          </fieldset>

          {problem && <p className="eac-compose-problem">{problem}</p>}

          <div className="eac-compose-actions">
            <button
              type="button"
              className="eac-btn eac-btn--primary"
              onClick={() => void accept()}
              disabled={saving}
            >
              {saving ? "Turning it on…" : "Turn it on"}
            </button>
          </div>
        </>
      )}
    </SurfaceFrame>
  );
}

// ── Work for sale ───────────────────────────────────────────────────────────

/**
 * Listing a piece, in place.
 *
 * The form is `@elkdonis/cms-ui/compose`'s, not this app's — a member's store
 * belongs to the PERSON, so cataloguing work should be possible from any hub
 * they belong to rather than only from the marketplace. What stays here is the
 * save (and its gate) and the media picker, wired to this app's endpoints.
 */
export function ArtPieceGate() {
  return (
    <ArtPieceComposer
      checkStore={async () => {
        const r = await canListArtPieceAction();
        return { ok: r.ok, reason: r.reason };
      }}
      onSave={createArtPieceAction}
      marketplaceUrl={MARKETPLACE_URL}
      media={({ value, onChange, label, hint }) => (
        <MediaPicker
          value={value}
          onChange={onChange}
          uploadEndpoint="/api/upload"
          libraryEndpoint="/api/media/library"
          label={label}
          hint={hint}
        />
      )}
    />
  );
}

import * as React from "react";
import type { ForumViewer } from "@elkdonis/services";
import type { ForumConnectors } from "./connectors";

// ============================================================================
// Adding a category to a board.
//
// A category is a row in `org_feeds` — the thing the board table lists and a
// topic is posted into. Distinct from the network-wide `topics` taxonomy: a
// category is the org's own furniture, so the org's own members arrange it,
// while a topic crosses orgs and needs admin review.
//
// The panel wears the SHARED surface chrome (.eac-surface-panel / -head /
// -body / -foot, .eac-btn) so it matches every other card popup in the
// network, with the forum's own field classes inside it. It stays a plain
// <form> in a <details>: no client JavaScript, no hydration, nothing for a
// host to mount — the same property that lets the forum drop into a site in
// ~45 lines. The <form> IS the panel because .eac-surface-panel is the grid
// that the head/body/foot areas belong to.
// ============================================================================

/** Member and up — never a viewer, which is what a new signup lands on. */
export function canAddCategory(viewer: ForumViewer, orgId: string): boolean {
  if (!viewer.userId) return false;
  if (viewer.isGlobalAdmin) return true;
  const role = viewer.roles[orgId] ?? null;
  return role === "owner" || role === "guide" || role === "member";
}

export function NewCategoryPanel({
  connectors,
  viewer,
  orgId,
  orgSlug,
  orgName,
  back,
}: {
  connectors: ForumConnectors;
  viewer: ForumViewer;
  orgId: string;
  orgSlug: string;
  orgName: string;
  back: string;
}) {
  const { actionBase, write } = connectors;
  // No host write path, or not entitled: render nothing at all rather than a
  // disabled control. A viewer being shown a button they cannot press is a
  // worse answer than a board that simply doesn't offer it.
  if (!write?.createCategory || !actionBase) return null;
  if (!canAddCategory(viewer, orgId)) return null;

  const base = actionBase.replace(/\/$/, "");
  return (
    <details className="gf-newcat" id="newcategory">
      <summary className="gf-newcat-face">
        <span className="gf-newcat-face-glyph" aria-hidden>
          +
        </span>
        <span className="gf-newcat-face-text">
          <b>New category</b>
          <small>Another place on the board, with its own topics</small>
        </span>
      </summary>
      <form
        method="post"
        action={`${base}/category`}
        className="eac-surface-panel eac-surface-panel--page gf-newcat-panel"
      >
        <input type="hidden" name="org" value={orgId} />
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <input type="hidden" name="back" value={back} />

        <div className="eac-surface-head">
          <span className="eac-surface-headings">
            <span className="eac-surface-kicker">{orgName}</span>
            <span className="eac-surface-title">New category</span>
          </span>
        </div>

        <div className="eac-surface-body gf-newcat-fields">
          <label className="gf-field">
            <span className="gf-field-label">Name</span>
            <input
              name="name"
              className="gf-input"
              required
              minLength={2}
              maxLength={120}
              placeholder="e.g. Exhibitions"
              autoComplete="off"
            />
          </label>

          <label className="gf-field">
            <span className="gf-field-label">
              Tagline <span className="gf-field-hint">optional</span>
            </span>
            <input
              name="tagline"
              className="gf-input"
              maxLength={200}
              placeholder="One line on what belongs here"
              autoComplete="off"
            />
          </label>

          <fieldset className="gf-field gf-newcat-audience">
            <legend className="gf-field-label">Who can see it</legend>
            <label className="gf-chip gf-chip--pick">
              <input type="radio" name="audience" value="everyone" defaultChecked /> Everyone
            </label>
            <label className="gf-chip gf-chip--pick">
              <input type="radio" name="audience" value="members" /> Members of {orgName}
            </label>
          </fieldset>
        </div>

        <div className="eac-surface-foot">
          <span className="gf-newcat-note">
            Appears on this board — not in the site&rsquo;s own menu.
          </span>
          <span className="eac-surface-buttons">
            <button type="submit" className="eac-btn eac-btn--primary">
              Create category
            </button>
          </span>
        </div>
      </form>
    </details>
  );
}

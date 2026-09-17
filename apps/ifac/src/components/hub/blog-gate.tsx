"use client";

import * as React from "react";
import { toast } from "sonner";
import { SurfaceFrame, useSurface } from "@elkdonis/cms-ui/surface";
import { Button, Label, RadioGroup, RadioGroupItem } from "@elkdonis/primitives";
import {
  getBlogStateAction,
  setBlogStateAction,
  type BlogScope,
  type BlogState,
} from "@/lib/cms/blog-actions";

// ============================================================================
// The blog tile's door.
//
// Three states, and which one you get is the whole feature:
//
//   already on  → go straight to the blog. No ceremony for the second visit.
//   not on yet  → the offer, and the one decision that comes with it.
//   no profile  → nothing to hang a blog on; say so plainly.
//
// The decision is scope, and it is worth asking because a member's writing is
// NOT owned by this site. The same `kind='writing'` rows are written from
// every org they belong to, and the canonical home for a person's writing is
// their entry in the network's directory. What IFAC offers is a window onto
// that — either the part written here, or all of it.
// ============================================================================

const DIRECTORY = "directory.arts-collective.com";

export function BlogGate() {
  const surfaces = useSurface();
  const [state, setState] = React.useState<BlogState | null | "loading">("loading");
  const [scope, setScope] = React.useState<BlogScope>("org");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    getBlogStateAction()
      .then((s) => {
        if (cancelled) return;
        setState(s);
        if (s) setScope(s.scope);
        // Already on: this surface has nothing to ask, so it takes them
        // there rather than making them confirm a decision they made once.
        if (s?.enabled && s.href) window.location.assign(s.href);
      })
      .catch(() => !cancelled && setState(null));
    return () => {
      cancelled = true;
    };
  }, []);

  async function accept() {
    setSaving(true);
    const result = await setBlogStateAction({ enabled: true, scope });
    setSaving(false);
    if (!result.ok) return toast.error(result.error ?? "Could not save that");
    surfaces.connectors.onMutated?.();
    if (result.href) {
      window.location.assign(result.href);
    } else {
      toast.success("Your blog is on");
      surfaces.close();
    }
  }

  if (state === "loading") {
    return (
      <SurfaceFrame kind="post" title="Your blog" kicker="On your profile">
        <p className="eac-surface-muted">One moment…</p>
      </SurfaceFrame>
    );
  }

  if (!state) {
    return (
      <SurfaceFrame kind="post" title="Your blog" kicker="On your profile">
        <p className="eac-surface-empty">Could not read your profile.</p>
      </SurfaceFrame>
    );
  }

  if (!state.href) {
    return (
      <SurfaceFrame kind="post" title="Your blog" kicker="On your profile">
        <p className="eac-surface-empty">
          A blog is a section of your profile page, and you do not have a
          profile on IFAC yet. Set one up and this will live on it.
        </p>
      </SurfaceFrame>
    );
  }

  if (state.enabled) {
    // The effect above is already navigating; this is what the half-second
    // before it looks like.
    return (
      <SurfaceFrame kind="post" title="Your blog" kicker="On your profile">
        <p className="eac-surface-muted">Opening your blog…</p>
      </SurfaceFrame>
    );
  }

  return (
    <SurfaceFrame
      kind="post"
      title="Add a blog to your profile"
      kicker="On your profile"
      actions={[
        { label: "Not now", quiet: true, onClick: () => surfaces.close() },
        {
          label: saving ? "Turning it on…" : "Add it to my profile",
          primary: true,
          onClick: () => void accept(),
          disabled: saving,
        },
      ]}
    >
      <div className="eac-compose">
        <p className="ifac-blog-lede">
          A section on your IFAC page where you write in your own voice — notes
          from the studio, what a piece came out of, what you are looking at.
          It is yours, not the collective&rsquo;s: nothing you write here
          reaches IFAC&rsquo;s feeds or its forum.
        </p>

        <section className="eac-group">
          <h3>What should show here</h3>
          <RadioGroup value={scope} onValueChange={(v) => setScope(v as BlogScope)}>
            <label className="eac-check ifac-blog-choice">
              <RadioGroupItem value="org" />
              <span>
                <strong>Only what I write on IFAC</strong>
                <em>
                  A reader arriving from the collective sees work in that
                  context.
                </em>
              </span>
            </label>
            <label className="eac-check ifac-blog-choice">
              <RadioGroupItem value="all" />
              <span>
                <strong>Everything I write across the network</strong>
                <em>
                  Your writing from every group you belong to, gathered on this
                  page.
                </em>
              </span>
            </label>
          </RadioGroup>
        </section>

        <p className="ifac-compose-note">
          Either way your writing lives in the network&rsquo;s directory at{" "}
          <strong>{DIRECTORY}</strong> — that is the copy that follows you, and
          this page is a window onto it. You can change which one shows at any
          time from Page sections.
        </p>
      </div>
    </SurfaceFrame>
  );
}

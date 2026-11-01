"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WelcomeContent } from "@/lib/home-sections";
import { saveWelcomeAction } from "@/app/home-actions";

// The welcome letter above the hero (Welcome 4): "Welcome." with a burgundy
// rule and the site's address on the left; the letter and the About link on
// the right. The site's owners edit it in place.

export function HomeWelcome({ content, canEdit }: { content: WelcomeContent; canEdit: boolean }) {
  const [editing, setEditing] = React.useState(false);
  const external = /^https:/.test(content.linkHref);
  return (
    <section className="hw" aria-label="Welcome">
      <div className="hw-in">
        <div className="hw-side">
          <p className="hw-heading">{content.heading}</p>
          <div className="hw-rule" aria-hidden="true" />
          {content.subline && <p className="hw-subline">{content.subline}</p>}
        </div>
        <div className="hw-main">
          <p className="hw-body">{content.body}</p>
          <p className="hw-link">
            {external ? (
              <a href={content.linkHref}>{content.linkLabel}</a>
            ) : (
              <Link href={content.linkHref}>{content.linkLabel}</Link>
            )}
          </p>
        </div>
        {canEdit && (
          <button type="button" className="hw-edit" onClick={() => setEditing(true)}>
            Edit welcome
          </button>
        )}
      </div>
      {editing && <WelcomeDialog initial={content} onClose={() => setEditing(false)} />}
    </section>
  );
}

function WelcomeDialog({ initial, onClose }: { initial: WelcomeContent; onClose: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<WelcomeContent>(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const set = (k: keyof WelcomeContent) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await saveWelcomeAction(draft);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "Could not save.");
      return;
    }
    router.refresh();
    onClose();
  };

  return (
    <dialog ref={ref} className="hw-dialog" onClose={onClose} aria-label="Edit the welcome">
      <form onSubmit={save} className="hw-form">
        <h2>Welcome section</h2>
        <label>
          <span>Heading</span>
          <input value={draft.heading} onChange={set("heading")} maxLength={60} required />
        </label>
        <label>
          <span>Line under the rule</span>
          <input value={draft.subline} onChange={set("subline")} maxLength={120} placeholder="Collect Art · market.arts-collective.com" />
        </label>
        <label>
          <span>The letter</span>
          <textarea value={draft.body} onChange={set("body")} rows={6} maxLength={1200} required />
        </label>
        <div className="hw-form-row">
          <label>
            <span>Link text</span>
            <input value={draft.linkLabel} onChange={set("linkLabel")} maxLength={80} required />
          </label>
          <label>
            <span>Link goes to</span>
            <input value={draft.linkHref} onChange={set("linkHref")} maxLength={300} placeholder="/about" required />
          </label>
        </div>
        {error && <p className="hw-form-error" role="alert">{error}</p>}
        <div className="hw-form-actions">
          <button type="button" className="hw-btn" onClick={() => ref.current?.close()} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="hw-btn is-accent" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

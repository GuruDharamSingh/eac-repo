"use client";

import * as React from "react";
import type { SurfaceAction, SurfaceDescriptor, SurfacePostTarget } from "../types";
import { useLayer, useSurface } from "../context";
import { SurfaceFrame, SurfaceSkeleton } from "../SurfaceShell";

// ============================================================================
// Post to… — /center's compose, for anywhere you belong (Brief A slice 3).
//
// A person on one org's /center can start a topic in any org they are part
// of, as themselves, or write on their own blog. One destination per post.
// The list comes from the host (`connectors.postTo.targets`); the host's
// server re-checks the chosen place, so this select is a convenience, never
// the permission.
//
// Deliberately plain: a title and text, like starting a forum topic. The
// writing room stays the place for a long, formatted piece on this site.
// ============================================================================

type Descriptor = Extract<SurfaceDescriptor, { type: "postTo" }>;

const FIELD =
  "w-full rounded-[var(--sf-radius-sm)] border border-[color:var(--sf-muted)] bg-[color:var(--sf-bg)] px-3 py-2 text-[0.95rem] text-[color:var(--sf-fg)] outline-none focus:border-[color:var(--sf-fg)]";
const LABEL =
  "block font-[family-name:var(--sf-font-record)] text-[0.64rem] uppercase tracking-[0.14em] text-[color:var(--sf-muted)] mb-1";

export function PostToSurface({ descriptor }: { descriptor: Descriptor }) {
  const { connectors, pop } = useSurface();
  const layer = useLayer();
  const api = connectors.postTo;

  const [targets, setTargets] = React.useState<SurfacePostTarget[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [target, setTarget] = React.useState(descriptor.target ?? "");
  const [title, setTitle] = React.useState(descriptor.title ?? "");
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ href: string | null; label: string } | null>(null);

  React.useEffect(() => {
    layer.setMeta({ title: "New post", kind: "post", size: "standard" });
  }, [layer]);

  React.useEffect(() => {
    if (!api) return;
    api
      .targets()
      .then((list) => {
        setTargets(list);
        // Keep a preselected destination only if it is really on offer.
        setTarget((t) => (t && list.some((x) => x.value === t) ? t : list[0]?.value ?? ""));
      })
      .catch(() => setFailed(true));
  }, [api]);

  const groups = React.useMemo(() => {
    const m = new Map<string, SurfacePostTarget[]>();
    for (const t of targets ?? []) {
      const key = t.kind === "blog" ? "You" : t.orgName;
      m.set(key, [...(m.get(key) ?? []), t]);
    }
    return [...m.entries()];
  }, [targets]);

  const chosen = targets?.find((t) => t.value === target) ?? null;
  const canPost = Boolean(chosen) && title.trim().length >= 2 && text.trim().length > 0 && !saving;

  async function publish() {
    if (!api || !canPost) return;
    setSaving(true);
    setError(null);
    const result = await api
      .create({ target, title: title.trim(), text })
      .catch(() => ({ ok: false as const, error: "Could not post that." }));
    setSaving(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setDone({ href: result.href, label: result.label });
    connectors.onMutated?.();
  }

  if (!api) {
    return (
      <SurfaceFrame kind="post" title="New post">
        <p className="eac-surface-empty">This site cannot post elsewhere yet.</p>
      </SurfaceFrame>
    );
  }

  if (done) {
    const actions: SurfaceAction[] = [
      ...(done.href ? [{ label: "Open it", href: done.href, primary: true }] : []),
      { label: "Done", quiet: !done.href, primary: !done.href, onClick: pop },
    ];
    return (
      <SurfaceFrame kind="post" title="Posted" kicker="Post to…" actions={actions}>
        <p className="text-[1rem]">
          Posted to <strong>{done.label}</strong>.
        </p>
      </SurfaceFrame>
    );
  }

  const actions: SurfaceAction[] = [
    { label: "Cancel", quiet: true, onClick: pop, disabled: saving },
    { label: saving ? "Posting…" : "Post", primary: true, onClick: publish, disabled: !canPost },
  ];

  return (
    <SurfaceFrame
      kind="post"
      title="New post"
      kicker="Post to…"
      actions={actions}
      status={error}
      statusTone={error ? "error" : "normal"}
    >
      {targets === null && !failed ? (
        <SurfaceSkeleton block />
      ) : failed ? (
        <p className="eac-surface-empty">Could not load where you can post.</p>
      ) : targets && targets.length === 0 ? (
        <p className="eac-surface-empty">There is nowhere you can post yet.</p>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void publish();
          }}
        >
          <label>
            <span className={LABEL}>Post to</span>
            <select className={FIELD} value={target} onChange={(e) => setTarget(e.target.value)}>
              {groups.map(([group, list]) => (
                <optgroup key={group} label={group}>
                  {list.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.kind === "blog" ? "My blog — on your page" : `${t.orgName} · ${t.feedName}`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="mt-1 block text-[0.8rem] text-[color:var(--sf-muted)]">
              {chosen?.kind === "blog"
                ? "Your own writing, on your page — never on an organisation’s feed."
                : chosen
                  ? `As yourself, in ${chosen.orgName}’s ${chosen.feedName}.`
                  : null}
            </span>
          </label>
          <label>
            <span className={LABEL}>Title</span>
            <input className={FIELD} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            <span className={LABEL}>Text</span>
            <textarea
              className={`${FIELD} min-h-[10rem]`}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <span className="mt-1 block text-[0.8rem] text-[color:var(--sf-muted)]">A blank line starts a new paragraph.</span>
          </label>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      )}
    </SurfaceFrame>
  );
}

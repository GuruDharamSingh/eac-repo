"use client";

import * as React from "react";
import type { SurfaceAction, SurfaceIdentity } from "../types";
import { useLayer, useSurface } from "../context";
import { SurfaceFrame } from "../SurfaceShell";

// ============================================================================
// The names you write under.
//
// Three relations, one list, because they are one mechanism. An identity is a
// `users` row; an organisation's own row (migration 099) and a pen name
// (migration 132) differ only in what each is allowed to HOLD — a body holds
// membership, storage and a domain, a pen name holds only what it wrote.
// Presenting them as two features would have been a statement about the
// database rather than about the person reading.
//
// They are grouped rather than sorted flat, because the three carry different
// promises and a member has to be able to tell which they are picking:
//
//   You            one row, never retired, the account itself.
//   Your own names private. Nothing public links them back to you, and this
//                  panel is the only place they appear together — which is
//                  exactly why the copy says so rather than implying it.
//   Bodies         not private. Everyone can see who runs an organisation;
//                  the byline is delegated by a role, and it is withdrawn
//                  when the role is.
//
// RETIRE IS NOT DELETE, and the confirm says so in those words. What a name
// wrote keeps its byline; retiring only stops new writing under it. Actually
// folding a name back into its holder is mergeProfile, which is irreversible
// and deliberately does not live behind this button.
// ============================================================================

const RELATION_ORDER: Record<SurfaceIdentity["relation"], number> = {
  self: 0,
  pseudonym: 1,
  organization: 2,
};

export function IdentitiesSurface() {
  const { connectors } = useSurface();
  const layer = useLayer();
  const api = connectors.identities;
  const max = api?.maxPseudonyms ?? 2;

  const [items, setItems] = React.useState<SurfaceIdentity[] | null>(null);
  const [name, setName] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [opening, setOpening] = React.useState(false);
  const [busy, setBusy] = React.useState<"idle" | "creating" | "retiring">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    layer.setMeta({ title: "Your names", kind: "neutral", size: "standard" });
  }, [layer]);

  const load = React.useCallback(async () => {
    if (!api) {
      setItems([]);
      return;
    }
    try {
      const rows = await api.list();
      setItems(
        [...rows].sort(
          (a, b) =>
            RELATION_ORDER[a.relation] - RELATION_ORDER[b.relation] ||
            a.displayName.localeCompare(b.displayName)
        )
      );
    } catch {
      setError("Could not load your names.");
      setItems([]);
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const pseudonyms = (items ?? []).filter((i) => i.relation === "pseudonym");
  const live = pseudonyms.filter((i) => !i.retiredAt).length;
  const atCap = live >= max;

  async function create() {
    if (!api?.create) return;
    const displayName = name.trim();
    if (displayName.length < 2) {
      setError("Give the name at least two characters.");
      return;
    }
    setBusy("creating");
    setError(null);
    setNotice(null);
    const result = await api.create({
      displayName,
      label: label.trim() || undefined,
    });
    setBusy("idle");
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setName("");
    setLabel("");
    setOpening(false);
    setNotice(`“${result.identity.displayName}” is yours to write under.`);
    void load();
    connectors.onMutated?.();
  }

  async function setRetired(identity: SurfaceIdentity, retired: boolean) {
    if (!api?.setRetired) return;
    if (
      retired &&
      !window.confirm(
        `Stop writing as “${identity.displayName}”?\n\n` +
          `Everything it has already written keeps its byline — this does not ` +
          `delete the name or put your own on its work. It only stops new ` +
          `writing under it, and you can start again whenever you like.`
      )
    ) {
      return;
    }
    setBusy("retiring");
    setError(null);
    setNotice(null);
    const result = await api.setRetired(identity.id, retired);
    setBusy("idle");
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setNotice(
      retired
        ? `“${identity.displayName}” is retired.`
        : `Writing as “${identity.displayName}” again.`
    );
    void load();
    connectors.onMutated?.();
  }

  if (!api) {
    return (
      <SurfaceFrame kind="neutral" title="Your names">
        <p className="eac-surface-empty">This site does not offer other names.</p>
      </SurfaceFrame>
    );
  }

  const actions: SurfaceAction[] = api.create
    ? opening
      ? [
          {
            label: busy === "creating" ? "Opening…" : "Open the name",
            primary: true,
            disabled: busy !== "idle" || name.trim().length < 2,
            onClick: () => void create(),
          },
          {
            label: "Cancel",
            quiet: true,
            disabled: busy !== "idle",
            onClick: () => {
              setOpening(false);
              setError(null);
            },
          },
        ]
      : [
          {
            label: "Open another name",
            primary: true,
            disabled: atCap || busy !== "idle",
            onClick: () => {
              setOpening(true);
              setNotice(null);
            },
          },
        ]
    : [];

  return (
    <SurfaceFrame
      kind="neutral"
      title="Your names"
      kicker="How your writing is signed"
      status={
        error ??
        notice ??
        (items === null
          ? "Loading…"
          : atCap
            ? `${live} of ${max} names in use — retire one to open another.`
            : `${live} of ${max} names in use.`)
      }
      statusTone={error ? "error" : "normal"}
      actions={actions}
    >
      {items === null ? null : (
        <div className="eac-ident-list">
          {items.map((identity) => (
            <IdentityRow
              key={identity.id}
              identity={identity}
              busy={busy !== "idle"}
              onRetire={
                identity.relation === "pseudonym" && api.setRetired
                  ? (retired) => void setRetired(identity, retired)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {opening ? (
        <form
          className="eac-ident-open"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <label className="eac-ident-label" htmlFor="eac-ident-name">
            The name to write under
          </label>
          <input
            id="eac-ident-name"
            className="eac-ident-input"
            value={name}
            maxLength={120}
            autoFocus
            placeholder="A name, not your own"
            onChange={(e) => setName(e.target.value)}
          />
          <label className="eac-ident-label" htmlFor="eac-ident-label">
            A note to yourself <span className="eac-ident-hint">(only you ever see this)</span>
          </label>
          <input
            id="eac-ident-label"
            className="eac-ident-input"
            value={label}
            maxLength={120}
            placeholder="the poetry one"
            onChange={(e) => setLabel(e.target.value)}
          />
          {/* Said plainly and up front, because it is the thing a person is
              actually deciding — and because the honest version has a limit
              in it. */}
          <p className="eac-ident-note">
            A new name starts unlisted: it stays out of the directory until you
            put it there. Nothing public connects it to you. It is not a
            separate login — you write as it from here.
          </p>
        </form>
      ) : null}
    </SurfaceFrame>
  );
}

function IdentityRow({
  identity,
  busy,
  onRetire,
}: {
  identity: SurfaceIdentity;
  busy: boolean;
  onRetire?: (retired: boolean) => void;
}) {
  const retired = Boolean(identity.retiredAt);
  const kicker =
    identity.relation === "self"
      ? "You"
      : identity.relation === "organization"
        ? "Organisation"
        : retired
          ? "Retired"
          : "Your own name";

  return (
    <div className={`eac-ident-row${retired ? " is-retired" : ""}`}>
      <span className="eac-ident-avatar" aria-hidden>
        {identity.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={identity.avatarUrl} alt="" />
        ) : (
          <span className="eac-ident-initial">
            {identity.displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>
      <span className="eac-ident-body">
        <span className="eac-ident-kicker">{kicker}</span>
        <span className="eac-ident-name">{identity.displayName}</span>
        {identity.label ? (
          <span className="eac-ident-note-inline">{identity.label}</span>
        ) : null}
      </span>
      {onRetire ? (
        <button
          type="button"
          className="eac-ident-action"
          disabled={busy}
          onClick={() => onRetire(!retired)}
        >
          {retired ? "Use again" : "Retire"}
        </button>
      ) : null}
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { setPageBackgroundAction, setSectionOrderAction } from "@/lib/space-actions";
import { openNewPieceAction } from "@/lib/writing-actions";
import { connectSocialAction, setSocialSectionAction } from "@/lib/social-actions";
import styles from "./PersonDrawer.module.css";

// ============================================================================
// The left drawer on an ArtDirect person page (developer, 2026-09-27).
//
// For everyone: portrait, name, bio, and a way to reach the person (their
// Email link as mailto, else their Website; there is no direct messaging on
// the platform yet). For the person themselves: write a post / the writing
// desk, Studio and the Arts Collective hub on arts-collective.com, the order of
// their page's sections, and the page background.
// ============================================================================

export type DrawerSection = { key: string; label: string; on: boolean };

/** One connectable account in the owner's drawer. */
export type DrawerAccount = { connected: boolean; name: string | null; on: boolean };
export type DrawerSocial = { instagram: DrawerAccount; youtube: DrawerAccount };

type Props = {
  slug: string;
  displayName: string;
  portraitUrl: string | null;
  bio: string | null;
  contactHref: string | null;
  isOwner: boolean;
  networkUrl: string;
  sections: DrawerSection[];
  pageBackground: string | null;
  /** Owner only: Instagram and YouTube state. */
  social?: DrawerSocial;
  /** Owner only: Studio and the network's Connections tab, each wrapped in the sign-in handoff. */
  studioHref?: string;
  connectionsHref?: string;
};

const DEFAULT_GROUND = "#020202";

export function PersonDrawer(props: Props) {
  const { slug, displayName, portraitUrl, bio, contactHref, isOwner, networkUrl } = props;
  const [open, setOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isMail = contactHref?.startsWith("mailto:") ?? false;

  return (
    <>
      <button
        type="button"
        className={styles.tab}
        aria-expanded={open}
        aria-controls="oad-person-drawer"
        onClick={() => setOpen(true)}
      >
        {displayName}
      </button>
      {open && <div className={styles.scrim} onClick={() => setOpen(false)} aria-hidden />}
      <div
        id="oad-person-drawer"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal={open}
        aria-label={displayName}
        className={`${styles.drawer}${open ? ` ${styles.open}` : ""}`}
        hidden={!open}
      >
        <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close">
          ✕
        </button>

        {portraitUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.portrait} src={portraitUrl} alt="" />
        ) : (
          <div className={`${styles.portrait} ${styles.portraitBlank}`} aria-hidden>
            ◯
          </div>
        )}
        <h2 className={styles.name}>{displayName}</h2>
        {bio ? <p className={styles.bio}>{bio}</p> : null}

        {contactHref && !isOwner ? (
          <p>
            <a
              className={styles.primary}
              href={contactHref}
              {...(isMail ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            >
              {isMail ? "Message" : "Contact"}
            </a>
          </p>
        ) : null}

        {isOwner ? (
          <>
            <nav className={styles.links} aria-label="Your space">
              {/* Both open the desk on a new piece directly (openNewPieceAction). */}
              <form action={openNewPieceAction}>
                <button type="submit" className={`${styles.primary} ${styles.full}`}>
                  Write a post
                </button>
              </form>
              <form action={openNewPieceAction}>
                <button type="submit" className={styles.linkButton}>
                  Writing desk
                </button>
              </form>
              <a className={styles.link} href={`/${slug}/writing`}>
                All your writing
              </a>
              <a className={`${styles.primary} ${styles.full}`} href={props.studioHref ?? `${networkUrl}/studio`}>
                Open Studio
              </a>
              <a className={styles.link} href={`${networkUrl}/hub/arts-collective`}>
                Arts Collective hub
              </a>
            </nav>
            {props.social ? <Accounts initial={props.social} connectionsHref={props.connectionsHref} /> : null}
            <SectionOrder initial={props.sections} />
            <Background initial={props.pageBackground} />
          </>
        ) : null}
      </div>
    </>
  );
}

function SectionOrder({ initial }: { initial: DrawerSection[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => setItems(initial), [initial]);

  const move = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    setSaving(true);
    setError(null);
    const result = await setSectionOrderAction(next.map((s) => s.key));
    setSaving(false);
    if (!result.ok) {
      setItems(items);
      setError(result.error ?? "Could not save the order.");
      return;
    }
    router.refresh();
  };

  return (
    <section className={styles.block} aria-label="Order of your page">
      <h3 className={styles.heading}>Order of your page</h3>
      <p className={styles.note}>Hidden sections keep their place for when you turn them on.</p>
      <ol className={styles.order}>
        {items.map((s, i) => (
          <li key={s.key} className={styles.orderItem}>
            <span className={s.on ? undefined : styles.off}>
              {s.label}
              {s.on ? "" : " (hidden)"}
            </span>
            <span className={styles.orderButtons}>
              <button
                type="button"
                className={styles.small}
                onClick={() => move(i, -1)}
                disabled={saving || i === 0}
                aria-label={`Move ${s.label} up`}
              >
                ↑
              </button>
              <button
                type="button"
                className={styles.small}
                onClick={() => move(i, 1)}
                disabled={saving || i === items.length - 1}
                aria-label={`Move ${s.label} down`}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}

function Background({ initial }: { initial: string | null }) {
  const router = useRouter();
  const [value, setValue] = React.useState(initial ?? DEFAULT_GROUND);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const save = async (color: string | null) => {
    setSaving(true);
    setError(null);
    const result = await setPageBackgroundAction(color);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save the colour.");
      return;
    }
    if (color === null) setValue(DEFAULT_GROUND);
    router.refresh();
  };

  return (
    <section className={styles.block} aria-label="Page background">
      <h3 className={styles.heading}>Page background</h3>
      <p className={styles.note}>Dark colours only for now, so your text stays readable.</p>
      <div className={styles.row}>
        <input
          type="color"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Background colour"
          className={styles.swatch}
        />
        <button type="button" className={styles.small} onClick={() => save(value)} disabled={saving}>
          Save
        </button>
        <button type="button" className={styles.small} onClick={() => save(null)} disabled={saving}>
          Reset
        </button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}

const ACCOUNT_LABEL = { instagram: "Instagram", youtube: "YouTube" } as const;

/**
 * Connect Instagram or YouTube and choose whether each shows on the page.
 * Both are off until switched on; connecting sends the person through the
 * provider's consent on the network host and back to this page.
 */
function Accounts({ initial, connectionsHref }: { initial: DrawerSocial; connectionsHref?: string }) {
  const router = useRouter();
  const [state, setState] = React.useState(initial);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const connect = async (key: "instagram" | "youtube") => {
    setBusy(key);
    setError(null);
    const r = await connectSocialAction(key);
    if (!r.ok || !r.href) {
      setBusy(null);
      setError(r.error ?? "Could not start the connection.");
      return;
    }
    window.location.assign(r.href);
  };

  const toggle = async (key: "instagram" | "youtube", on: boolean) => {
    const before = state;
    setState({ ...state, [key]: { ...state[key], on } });
    setBusy(key);
    setError(null);
    const r = await setSocialSectionAction(key, on);
    setBusy(null);
    if (!r.ok) {
      setState(before);
      setError(r.error ?? "Could not save.");
      return;
    }
    router.refresh();
  };

  return (
    <section className={styles.block} aria-label="Instagram and YouTube">
      <h3 className={styles.heading}>Instagram and YouTube</h3>
      <p className={styles.note}>Connect an account, then choose whether its latest posts or videos show on your page.</p>
      <ul className={styles.order}>
        {(["instagram", "youtube"] as const).map((key) => {
          const a = state[key];
          return (
            <li key={key} className={styles.accountItem}>
              <span>
                {ACCOUNT_LABEL[key]}
                {a.connected && a.name ? <span className={styles.off}> · {a.name}</span> : null}
              </span>
              {a.connected ? (
                <label className={styles.row}>
                  <input
                    type="checkbox"
                    checked={a.on}
                    disabled={busy === key}
                    onChange={(e) => toggle(key, e.target.checked)}
                  />
                  <span>Show on my page</span>
                </label>
              ) : (
                <button type="button" className={styles.small} disabled={busy === key} onClick={() => connect(key)}>
                  {busy === key ? "Opening…" : "Connect"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {connectionsHref ? (
        <p className={styles.note}>
          <a className={styles.link} href={connectionsHref}>
            Manage or disconnect accounts
          </a>
        </p>
      ) : null}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}

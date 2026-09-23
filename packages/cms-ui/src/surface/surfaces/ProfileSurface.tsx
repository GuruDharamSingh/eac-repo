"use client";

import * as React from "react";
import type {
  SurfaceAction,
  SurfaceDescriptor,
  SurfaceProfile,
  SurfaceProfileLink,
  SurfaceProfileTab,
  SurfacePresence,
  SurfacePresenceCell,
  SurfacePresenceColumn,
  SurfacePresenceRow,
} from "../types";
import { useLayer, useSurface } from "../context";
import { SurfaceFrame, SurfaceSkeleton } from "../SurfaceShell";
import { serializeDescriptor, urlWithSurface, SURFACE_PARAM } from "../url";

// ============================================================================
// The flip side of a profile card — and, on your own card, the control panel.
//
// A person's network-wide identity — the ArtDirect profile, one row in
// `users` — read and edited here, wherever the card was clicked. With a
// `target` it is an organisation's identity instead (the org's own `users`
// row since migration 099), which is how an org finally gets a display
// image without leaving its site.
//
// On a person's OWN profile the popup has tabs (Brief A, 2026-09-18):
//   Profile   the card: portrait, name, headline, statement
//   Page      what their page carries (the host's `page` connector)
//   Payouts   whether a sale can reach them (the same connector)
//   Details   portfolio, links, city, the rest of where they
//             are (folded), comment colour, then account facts + Sign out
// A tab appears only when the host can fill it, so amrit-canada — which
// serves none of the extras — still gets the single card it always had.
// The tab is in the address (`?surface=profile:details`) so a link can
// land on it; switching tabs rewrites the address in place rather than
// re-opening the layer, which would reload everything.
//
// Tailwind utilities are used here on purpose (the owner's call for the
// center work); colours still come from the surface tokens so an org's
// theme carries through.
// ============================================================================

type Descriptor = Extract<SurfaceDescriptor, { type: "profile" }>;

const FIELD =
  "w-full rounded-[var(--sf-radius-sm)] border border-[color:var(--sf-line)] bg-[color:var(--sf-bg)] px-3 py-2 text-[0.95rem] text-[color:var(--sf-fg)] outline-none focus:border-[color:var(--sf-accent)]";
const LABEL =
  "block font-[family-name:var(--sf-font-record)] text-[0.64rem] uppercase tracking-[0.14em] text-[color:var(--sf-muted)] mb-1";
const HINT = "mt-1 block text-[0.8rem] leading-snug text-[color:var(--sf-muted)]";

// Asked once, before a Stripe account exists (see SurfaceProfilePayouts —
// the account's country is fixed at creation and Stripe never changes it
// after). A short, deliberately unexciting list: not every Stripe Express
// country, just the ones this network has actually paid into so far. cms-ui
// keeps its own copy rather than importing @elkdonis/commerce's — see the
// SurfacePresence note above for why this file takes no such dependency.
const PAYOUT_COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "CA", name: "Canada" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "PT", name: "Portugal" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "PL", name: "Poland" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
];

const TAB_LABEL: Record<SurfaceProfileTab, string> = {
  profile: "Profile",
  details: "Details",
  show: "Where you show",
  page: "Page",
  payouts: "Payouts",
};

type CardDraft = {
  displayName: string;
  headline: string;
  bio: string;
  pronouns: string;
  city: string;
  region: string;
  country: string;
  avatarUrl: string | null;
  socialLinks: SurfaceProfileLink[];
};

type DetailsDraft = {
  pronouns: string;
  city: string;
  region: string;
  country: string;
  postalCode: string;
  portfolioUrl: string;
  commentColor: string;
  socialLinks: SurfaceProfileLink[];
};

function cardDraftOf(p: SurfaceProfile): CardDraft {
  return {
    displayName: p.displayName,
    headline: p.headline ?? "",
    bio: p.bio ?? "",
    pronouns: p.pronouns ?? "",
    city: p.city ?? "",
    region: p.region ?? "",
    country: p.country ?? "",
    avatarUrl: p.avatarUrl,
    socialLinks: p.socialLinks,
  };
}

function detailsDraftOf(p: SurfaceProfile): DetailsDraft {
  return {
    pronouns: p.pronouns ?? "",
    city: p.city ?? "",
    region: p.region ?? "",
    country: p.country ?? "",
    postalCode: p.details?.postalCode ?? "",
    portfolioUrl: p.details?.portfolioUrl ?? "",
    commentColor: p.details?.commentColor ?? "",
    socialLinks: p.socialLinks,
  };
}

// WCAG 2.1 contrast, for the comment-colour preview. The ground is read off
// the dialog at runtime because an org's theme sets it, not this file.
function luminance(rgb: [number, number, number]) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function parseRgb(css: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(css.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(css);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function contrast(a: string, b: string): number | null {
  const x = parseRgb(a);
  const y = parseRgb(b);
  if (!x || !y) return null;
  const [l1, l2] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Minor units to a currency string. Not imported from @elkdonis/commerce:
// cms-ui takes no dependency on it (see SurfaceProfilePayouts["work"]), and
// this is the one place that needs it.
function formatMoney(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

// A host's onboarding copy may name a URL in plain text ("arts-collective.com/
// hub/elkdonis") rather than markup — the connector sends plain strings, not
// JSX. This turns anything URL-shaped back into a real link.
const URL_LIKE = /(https?:\/\/[^\s]+|\b[a-z0-9-]+\.(?:com|org|net|io)(?:\/[^\s]*)?)/gi;
function linkify(text: string): React.ReactNode {
  return text.split(URL_LIKE).map((part, i) => {
    if (/^(?:https?:\/\/|[a-z0-9-]+\.(?:com|org|net|io))/i.test(part)) {
      const href = part.startsWith("http") ? part : `https://${part}`;
      return (
        <a key={i} className="underline underline-offset-2" href={href} target="_blank" rel="noopener">
          {part}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/**
 * Whether the popup is in its stacked (phone) layout — the same 760px at which
 * surface.css stacks the rail, and puts it FIRST.
 */
function useNarrow(query = "(max-width: 760px)") {
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    const m = window.matchMedia(query);
    const update = () => setNarrow(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, [query]);
  return narrow;
}

export function ProfileSurface({ descriptor }: { descriptor: Descriptor }) {
  const { connectors, push } = useSurface();
  const layer = useLayer();
  const target = descriptor.target;

  const [profile, setProfile] = React.useState<SurfaceProfile | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "missing" | "error">("loading");
  const [draft, setDraft] = React.useState<CardDraft | null>(null);
  const [details, setDetails] = React.useState<DetailsDraft | null>(null);
  // Which half of the Profile tab is showing. The face offers both doors, so
  // a member who came to check what was waiting for them never lands in a
  // form they did not ask for.
  const [editing, setEditing] = React.useState(descriptor.mode === "edit");
  const [tab, setTab] = React.useState<SurfaceProfileTab>(target ? "profile" : descriptor.tab ?? "profile");

  // What this person's own page carries, and whether they can be paid.
  // Only their OWN profile has either — an org identity has no writing shelf
  // and, by the settled money model, never a connected account.
  const pageConnectors = !target ? connectors.profile?.page : undefined;
  const [page, setPage] = React.useState<
    Awaited<ReturnType<NonNullable<typeof pageConnectors>["load"]>> | null
  >(null);
  const presenceConnectors = !target ? connectors.profile?.presence : undefined;
  const [presence, setPresence] = React.useState<SurfacePresence | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [tone, setTone] = React.useState<"normal" | "error">("normal");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [ground, setGround] = React.useState<string | null>(null);
  const narrow = useNarrow();
  // Only asked once, before a Stripe account exists — see
  // SurfaceProfilePayouts["country"].
  const [payoutCountry, setPayoutCountry] = React.useState("");

  const load = React.useCallback(async () => {
    if (!connectors.profile) {
      setState("missing");
      return;
    }
    setState("loading");
    try {
      // The page panel loads alongside and fails soft on its own: the card is
      // the point, and a panel that cannot load must not take it down. It is
      // awaited so a link to the Page tab does not flash the Profile tab first.
      const [p, pg, pr] = await Promise.all([
        connectors.profile.load(target),
        pageConnectors ? pageConnectors.load().catch(() => null) : Promise.resolve(null),
        presenceConnectors ? presenceConnectors.load().catch(() => null) : Promise.resolve(null),
      ]);
      setPage(pg);
      setPresence(pr);
      if (!p) {
        setState("missing");
        return;
      }
      setProfile(p);
      setDraft(cardDraftOf(p));
      setDetails(detailsDraftOf(p));
      setState("ready");
    } catch {
      setState("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectors, target]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    layer.setMeta({
      title: profile?.displayName ?? (target ? "Organisation" : "Your profile"),
      kind: "neutral",
      size: "wide",
    });
  }, [layer, profile, target]);

  // The popup's own ground, for the comment-colour contrast readout.
  React.useEffect(() => {
    const el = rootRef.current?.closest(".eac-surface-panel, dialog") as HTMLElement | null;
    if (el) setGround(getComputedStyle(el).backgroundColor);
  }, [state, tab]);

  // On a phone this line sat above the name saying nothing a member needed —
  // the title already carries the name, and the tabs below it carry the
  // rest. Kept on the wide layout, where it sits beside the rail instead of
  // crowding the name.
  const kicker = narrow
    ? ""
    : target
      ? "Organisation · identity on the collective"
      : "You · identity across the collective";

  if (state !== "ready" || !profile || !draft || !details) {
    return (
      <SurfaceFrame kind="neutral" title={target ? "Organisation" : "Your profile"} kicker={kicker}>
        {state === "loading" && <SurfaceSkeleton block />}
        {state === "missing" && (
          <p className="eac-surface-empty">
            {connectors.profile ? "There is no profile to show." : "This site cannot open profiles yet."}
          </p>
        )}
        {state === "error" && (
          <p className="eac-surface-empty">
            Could not load it.{" "}
            <button type="button" className="eac-btn eac-btn--quiet" onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}
      </SurfaceFrame>
    );
  }

  const canEdit = profile.canEdit;
  const own = !target && profile.kind === "person" && canEdit;
  const hasDetails = own && Boolean(profile.details);

  // Only tabs this host can fill. "Where you show" joins in slice 2.
  const tabs: SurfaceProfileTab[] = ["profile"];
  // "Page" folded into "Where you show" (2026-09-20): both are about where a
  // member's presence reaches, and a standalone tab for one page's worth of
  // switches read as one tab too many. Its content still renders — at the
  // top of "show" (see pagePanel calls below) — just not under its own tab.
  const hasPage = Boolean(own && page && page.sections.length > 0);
  const hasPresence = Boolean(own && presence && presence.rows.length > 0);
  if (hasPage || hasPresence) tabs.push("show");
  if (own && page?.payouts) tabs.push("payouts");
  if (hasDetails) tabs.push("details");
  const current: SurfaceProfileTab = tabs.includes(tab) ? tab : "profile";

  function selectTab(next: SurfaceProfileTab) {
    setTab(next);
    setNotice(null);
    // Rewrite the address in place: re-opening the layer would remount it and
    // reload every tab. Only when this layer is the one in the address.
    if (!layer.isTop || typeof window === "undefined") return;
    const now = new URL(window.location.href).searchParams.get(SURFACE_PARAM);
    if (!now || !now.startsWith("profile")) return;
    const value = serializeDescriptor({ type: "profile", tab: next === "profile" ? undefined : next });
    window.history.replaceState(window.history.state, "", urlWithSurface(value));
  }

  const isEditing = canEdit && editing;
  const alerts = profile.alerts;

  function fail(message: string) {
    setTone("error");
    setNotice(message);
  }

  async function saveCard() {
    if (!connectors.profile || !draft) return;
    setSaving(true);
    setNotice(null);
    const nz = (v: string) => (v.trim() ? v.trim() : null);
    // With a Details tab, the card saves only what the card shows; the rest
    // belongs to Details and must not be overwritten from a stale copy here.
    const result = await connectors.profile.save(target, {
      displayName: draft.displayName.trim() || profile!.displayName,
      headline: nz(draft.headline),
      bio: nz(draft.bio),
      avatarUrl: draft.avatarUrl,
      ...(hasDetails
        ? {}
        : {
            pronouns: nz(draft.pronouns),
            city: nz(draft.city),
            region: nz(draft.region),
            country: nz(draft.country),
            socialLinks: draft.socialLinks.filter((l) => l.url.trim()),
          }),
    });
    setSaving(false);
    if (result.ok === false) return fail(result.error);
    setTone("normal");
    setNotice("Saved");
    connectors.onMutated?.();
    void load();
  }

  async function saveDetails() {
    if (!connectors.profile || !details) return;
    setSaving(true);
    setNotice(null);
    const nz = (v: string) => (v.trim() ? v.trim() : null);
    const result = await connectors.profile.save(undefined, {
      pronouns: nz(details.pronouns),
      city: nz(details.city),
      region: nz(details.region),
      country: nz(details.country),
      postalCode: nz(details.postalCode),
      portfolioUrl: nz(details.portfolioUrl),
      commentColor: nz(details.commentColor),
      socialLinks: details.socialLinks.filter((l) => l.url.trim()),
    });
    setSaving(false);
    if (result.ok === false) return fail(result.error);
    setTone("normal");
    setNotice("Saved");
    connectors.onMutated?.();
    void load();
  }

  async function onPickAvatar(files: FileList | null) {
    const file = files?.[0];
    if (!file || !connectors.profile?.uploadAvatar) return;
    setUploading(true);
    setNotice(null);
    const r = await connectors.profile.uploadAvatar(file);
    setUploading(false);
    if (r.ok === false) return fail(r.error);
    const url = r.url;
    setDraft((d) => (d ? { ...d, avatarUrl: url } : d));
    setTone("normal");
    setNotice("Photo uploaded — save to keep it");
  }

  // ── actions, per tab ─────────────────────────────────────────────────────
  const actions: SurfaceAction[] = [];
  if (current === "profile") {
    if (isEditing) {
      actions.push({ label: saving ? "Saving…" : "Save", primary: true, disabled: saving, onClick: saveCard });
      actions.push({ label: "Done", quiet: true, onClick: () => setEditing(false) });
    } else if (canEdit) {
      actions.push({ label: "Edit", primary: true, onClick: () => setEditing(true) });
    }
  } else if (current === "details") {
    actions.push({ label: saving ? "Saving…" : "Save details", primary: true, disabled: saving, onClick: saveDetails });
  }
  if (profile.pageHref) actions.push({ label: target ? "Open page" : "Your page", href: profile.pageHref, quiet: true });
  if (current === "profile" && !target && connectors.viewer.canCompose) {
    actions.push({ label: "Write a post", quiet: true, onClick: () => push({ type: "write", kind: "post" }) });
  }

  // ── the card itself: the rail on a wide popup, a row on a phone ─────────
  // Profile tab only. Stacked, surface.css puts the rail FIRST, which would
  // put a 3:4 portrait between the title and the tabs — so on a phone the
  // portrait shrinks to a row inside the tab instead.
  const photoControls = isEditing && connectors.profile?.uploadAvatar && (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onPickAvatar(e.target.files)}
      />
      <button
        type="button"
        className="eac-btn eac-btn--quiet"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? "Uploading…" : draft.avatarUrl ? "Change photo" : "Add a photo"}
      </button>
      {draft.avatarUrl && (
        <button
          type="button"
          className="eac-btn eac-btn--quiet"
          onClick={() => setDraft((d) => (d ? { ...d, avatarUrl: null } : d))}
        >
          Remove
        </button>
      )}
    </div>
  );
  const doors = (profile.hrefs?.files || profile.hrefs?.blog || profile.hrefs?.store) && (
    <nav className="flex flex-wrap gap-2" aria-label="Doors">
      {profile.hrefs?.files && <a className="eac-btn eac-btn--quiet" href={profile.hrefs.files}>Files</a>}
      {profile.hrefs?.blog && <a className="eac-btn eac-btn--quiet" href={profile.hrefs.blog}>Blog</a>}
      {profile.hrefs?.store && <a className="eac-btn eac-btn--quiet" href={profile.hrefs.store}>Store</a>}
    </nav>
  );
  const portraitImage = draft.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={draft.avatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
  ) : (
    <span className="absolute inset-0 grid place-items-center text-3xl text-[color:var(--sf-faint)]" aria-hidden>
      {target ? "◆" : "◯"}
    </span>
  );

  const rail =
    current !== "profile" || narrow ? undefined : (
      <div className="flex flex-col gap-3">
        <div className="relative overflow-hidden rounded-[var(--sf-radius-sm)] border border-[color:var(--sf-line)] bg-[color:var(--sf-bg-soft)] aspect-[3/4]">
          {portraitImage}
          <div className="absolute inset-x-0 bottom-0 bg-[color:var(--sf-bg)]/90 px-3 py-2 backdrop-blur">
            <div className="font-[family-name:var(--sf-font-title)] text-lg leading-tight">{draft.displayName || profile.displayName}</div>
            {draft.headline && <div className="text-xs text-[color:var(--sf-muted)]">{draft.headline}</div>}
          </div>
        </div>
        {photoControls}
        {doors}
      </div>
    );

  const compactCard =
    current === "profile" && narrow ? (
      <div className="grid gap-3">
        <div className="flex items-center gap-3">
          <div className="relative h-24 w-[4.5rem] shrink-0 overflow-hidden rounded-[var(--sf-radius-sm)] border border-[color:var(--sf-line)] bg-[color:var(--sf-bg-soft)]">
            {portraitImage}
          </div>
          <div className="min-w-0">
            <div className="font-[family-name:var(--sf-font-title)] text-lg leading-tight">{draft.displayName || profile.displayName}</div>
            {draft.headline && <div className="text-sm text-[color:var(--sf-muted)]">{draft.headline}</div>}
          </div>
        </div>
        {photoControls}
        {doors}
      </div>
    ) : null;

  const set = <K extends keyof CardDraft>(k: K, v: CardDraft[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  const setD = <K extends keyof DetailsDraft>(k: K, v: DetailsDraft[K]) =>
    setDetails((d) => (d ? { ...d, [k]: v } : d));

  // ── tab bodies ───────────────────────────────────────────────────────────

  const profileView = (
    <div className="grid gap-3">
      {alerts && (alerts.unreadMessages || alerts.notifications || alerts.upcoming) ? (
        // Counted, never linked. No host in the network has an inbox route
        // yet, and a number that is true is worth more than a button that
        // goes nowhere.
        <ul className="flex flex-wrap gap-2" aria-label="Waiting for you">
          {alerts.unreadMessages ? <li className="eac-chip">{alerts.unreadMessages} unread</li> : null}
          {alerts.notifications ? (
            <li className="eac-chip">
              {alerts.notifications} notification{alerts.notifications === 1 ? "" : "s"}
            </li>
          ) : null}
          {alerts.upcoming ? <li className="eac-chip">{alerts.upcoming} upcoming</li> : null}
        </ul>
      ) : null}
      {profile.headline && <p className="text-[0.95rem] text-[color:var(--sf-muted)]">{profile.headline}</p>}
      {profile.bio && <p className="whitespace-pre-line text-[0.95rem] leading-relaxed">{profile.bio}</p>}
      {[profile.city, profile.region, profile.country].filter(Boolean).length > 0 && (
        <p className="text-sm text-[color:var(--sf-muted)]">
          {[profile.city, profile.region, profile.country].filter(Boolean).join(", ")}
        </p>
      )}
      {profile.socialLinks.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {profile.socialLinks.map((l) => (
            <li key={l.url}>
              <a className="eac-btn eac-btn--quiet" href={l.url} target="_blank" rel="noopener">
                {l.label ?? l.url.replace(/^https?:\/\//, "")}
              </a>
            </li>
          ))}
        </ul>
      )}
      {/* A host without tabs keeps the page panel where it always was. */}
      {tabs.length === 1 && pagePanel(true)}
    </div>
  );

  const linksEditor = (links: SurfaceProfileLink[], onChange: (next: SurfaceProfileLink[]) => void) => (
    <fieldset className="grid gap-2">
      <legend className={LABEL}>Elsewhere</legend>
      {links.map((l, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2">
          <input
            className={FIELD}
            placeholder="Label"
            aria-label={`Link ${i + 1} label`}
            value={l.label ?? ""}
            onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, label: e.target.value || null } : x)))}
          />
          <input
            className={FIELD}
            placeholder="https://"
            aria-label={`Link ${i + 1} address`}
            value={l.url}
            onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
          />
          <button
            type="button"
            className="eac-btn eac-btn--quiet"
            aria-label="Remove link"
            onClick={() => onChange(links.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <div>
        <button
          type="button"
          className="eac-btn eac-btn--quiet"
          onClick={() => onChange([...links, { label: null, url: "" }])}
        >
          + Add a link
        </button>
      </div>
    </fieldset>
  );

  const profileForm = (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void saveCard();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={LABEL}>{target ? "Name" : "Display name"}</span>
          <input className={FIELD} value={draft.displayName} onChange={(e) => set("displayName", e.target.value)} required />
        </label>
        <label className="sm:col-span-2">
          <span className={LABEL}>Headline</span>
          <input
            className={FIELD}
            value={draft.headline}
            onChange={(e) => set("headline", e.target.value)}
            placeholder={target ? "What the organisation does, in a line" : "What you do, in a line"}
          />
        </label>
        {!hasDetails && (
          <>
            {!target && (
              <label>
                <span className={LABEL}>Pronouns</span>
                <input className={FIELD} value={draft.pronouns} onChange={(e) => set("pronouns", e.target.value)} />
              </label>
            )}
            <label>
              <span className={LABEL}>City</span>
              <input className={FIELD} value={draft.city} onChange={(e) => set("city", e.target.value)} />
            </label>
            <label>
              <span className={LABEL}>Region</span>
              <input className={FIELD} value={draft.region} onChange={(e) => set("region", e.target.value)} />
            </label>
            <label>
              <span className={LABEL}>Country</span>
              <input className={FIELD} value={draft.country} onChange={(e) => set("country", e.target.value)} />
            </label>
          </>
        )}
        <label className="sm:col-span-2">
          <span className={LABEL}>{target ? "About" : "Statement"}</span>
          <textarea className={`${FIELD} min-h-[8rem]`} value={draft.bio} onChange={(e) => set("bio", e.target.value)} />
        </label>
      </div>
      {hasDetails ? (
        <p className="text-[0.85rem] text-[color:var(--sf-muted)]">
          Location and links are under{" "}
          <button type="button" className="underline underline-offset-2 text-[color:var(--sf-fg)]" onClick={() => selectTab("details")}>
            Details
          </button>
          .
        </p>
      ) : (
        linksEditor(draft.socialLinks, (next) => set("socialLinks", next))
      )}
      {/* Enter submits; the Save in the foot is the visible control. */}
      <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
    </form>
  );

  const ratio = details.commentColor && ground ? contrast(details.commentColor, ground) : null;

  const account = profile.details?.account;
  const since = account?.createdAt
    ? new Date(account.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;
  const moreWhere = [details.region, details.country, details.postalCode].map((v) => v.trim()).filter(Boolean);

  async function signOut() {
    if (!account?.signOutEndpoint) return;
    setBusyKey("signout");
    await fetch(account.signOutEndpoint, { method: "POST" }).catch(() => null);
    window.location.assign(account.signOutTo ?? "/");
  }

  // Order is the user's (2026-09-18): your work and links first, then where you are — with province, country and postal code
  // folded away, because being asked for them straight off feels like a
  // form wanting too much. Read-only account facts and Sign out close it.
  const detailsForm = (
    <div className="grid gap-6">
      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void saveDetails();
        }}
      >

        <label>
          <span className={LABEL}>Portfolio</span>
          <input
            className={FIELD}
            type="url"
            inputMode="url"
            value={details.portfolioUrl}
            onChange={(e) => setD("portfolioUrl", e.target.value)}
            placeholder="https://"
          />
        </label>

        {linksEditor(details.socialLinks, (next) => setD("socialLinks", next))}

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={LABEL}>City</span>
            <input className={FIELD} autoComplete="address-level2" value={details.city} onChange={(e) => setD("city", e.target.value)} />
          </label>
          <label>
            <span className={LABEL}>Pronouns</span>
            <input className={FIELD} value={details.pronouns} onChange={(e) => setD("pronouns", e.target.value)} placeholder="she/her, they/them…" />
          </label>
        </div>

        <details className="group rounded-[var(--sf-radius-sm)] border border-[color:var(--sf-line)] px-3 py-2">
          <summary className="cursor-pointer select-none text-[0.9rem] text-[color:var(--sf-fg)]">
            More about where you are <span className="text-[color:var(--sf-muted)]">(optional)</span>
            {/* Counted, not echoed: printing the postal code on the fold
                would undo the point of folding it. */}
            {moreWhere.length > 0 && (
              <span className="ml-2 text-[0.85rem] text-[color:var(--sf-muted)]">· {moreWhere.length} filled in</span>
            )}
          </summary>
          <div className="mt-3 grid gap-4 pb-1 sm:grid-cols-3">
            <label>
              <span className={LABEL}>Province / state</span>
              <input className={FIELD} autoComplete="address-level1" value={details.region} onChange={(e) => setD("region", e.target.value)} />
            </label>
            <label>
              <span className={LABEL}>Country</span>
              <input className={FIELD} autoComplete="country-name" value={details.country} onChange={(e) => setD("country", e.target.value)} />
            </label>
            <label>
              <span className={LABEL}>Postal code</span>
              <input
                className={FIELD}
                autoComplete="postal-code"
                value={details.postalCode}
                maxLength={20}
                onChange={(e) => setD("postalCode", e.target.value)}
              />
            </label>
          </div>
        </details>

        <div>
          <span className={LABEL} id="eac-profile-color">Comment colour</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-labelledby="eac-profile-color"
              className="h-10 w-12 shrink-0 cursor-pointer rounded-[var(--sf-radius-sm)] border border-[color:var(--sf-line)] bg-[color:var(--sf-bg)] p-1"
              value={/^#[0-9a-f]{6}$/i.test(details.commentColor) ? details.commentColor : "#444444"}
              onChange={(e) => setD("commentColor", e.target.value)}
            />
            <span
              className="min-w-0 truncate font-semibold"
              style={details.commentColor ? { color: details.commentColor } : undefined}
            >
              {profile.displayName}
            </span>
            {details.commentColor && (
              <button type="button" className="eac-btn eac-btn--quiet ml-auto" onClick={() => setD("commentColor", "")}>
                Default
              </button>
            )}
          </div>
          <span className={HINT}>
            {!details.commentColor
              ? "Your name on replies. Unset, it uses the site's own ink."
              : ratio === null
                ? "Your name on replies."
                : ratio >= 4.5
                  ? `Readable here (${ratio.toFixed(1)}:1).`
                  : `Hard to read here (${ratio.toFixed(1)}:1, needs 4.5). Pick a darker colour.`}
          </span>
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>

      {account && (
        <section className="grid gap-3 border-t border-[color:var(--sf-line)] pt-4" aria-label="Your account">
          <span className={LABEL}>Your account</span>
          <dl className="grid gap-x-4 gap-y-2 text-[0.9rem] sm:grid-cols-[max-content_minmax(0,1fr)]">
            {account.email && (
              <>
                <dt className="text-[color:var(--sf-muted)]">Signed in as</dt>
                <dd className="m-0 break-all">{account.email}</dd>
              </>
            )}
            {since && (
              <>
                <dt className="text-[color:var(--sf-muted)]">Member since</dt>
                <dd className="m-0">{since}</dd>
              </>
            )}
            {account.cloud && (
              <>
                <dt className="text-[color:var(--sf-muted)]">Cloud storage</dt>
                <dd className="m-0 break-all">
                  <a className="underline underline-offset-2" href={account.cloud.url} target="_blank" rel="noopener">
                    {account.cloud.url.replace(/^https?:\/\//, "")}
                  </a>
                  <span className="text-[color:var(--sf-muted)]"> · username {account.cloud.username}</span>
                </dd>
              </>
            )}
          </dl>
          {account.signOutEndpoint && (
            <div>
              <button type="button" className="eac-btn" disabled={busyKey === "signout"} onClick={() => void signOut()}>
                {busyKey === "signout" ? "Signing out…" : "Sign out"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );

  // ── Where you show ───────────────────────────────────────────────────────
  async function flip(row: SurfacePresenceRow, column: SurfacePresenceColumn, on: boolean) {
    if (!presenceConnectors) return;
    const key = `${row.key}|${column.key}`;
    setBusyKey(key);
    setNotice(null);
    const result = await presenceConnectors
      .set({ row: row.key, column: column.key, on })
      .catch(() => ({ ok: false as const, error: "Could not save that." }));
    setBusyKey(null);
    if (result.ok === false) return fail(result.error || "Could not save that.");
    setTone("normal");
    setNotice(result.pending ? `Asked ${column.label}’s organisers` : "Saved");
    // Re-read: the server decides what the cell is now.
    presenceConnectors.load().then(setPresence).catch(() => {});
    connectors.onMutated?.();
  }

  function presenceCell(row: SurfacePresenceRow, column: SurfacePresenceColumn, cell: SurfacePresenceCell) {
    const key = `${row.key}|${column.key}`;
    const busy = busyKey === key;
    const note = cell.note ? (
      <span className="block text-[0.78rem] leading-snug text-[color:var(--sf-muted)]">{cell.note}</span>
    ) : null;
    if (cell.state === "status") {
      return (
        <span>
          <span className="text-[0.9rem]">{cell.label}</span>
          {note}
        </span>
      );
    }
    if (cell.state === "request") {
      return (
        <span className="flex flex-col items-start gap-1">
          <span className="text-[0.85rem] text-[color:var(--sf-muted)]">Not shown</span>
          {cell.pending ? (
            <span className="eac-chip">Requested</span>
          ) : (
            <button
              type="button"
              className="eac-btn eac-btn--quiet"
              disabled={busy}
              onClick={() => void flip(row, column, true)}
            >
              {busy ? "…" : "Ask to be shown"}
            </button>
          )}
          {note}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={cell.on}
          aria-label={`${row.label} — ${column.label}`}
          disabled={busy}
          onClick={() => void flip(row, column, !cell.on)}
          className={
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors disabled:opacity-60 " +
            // Ink, not the accent: a host accent is often a light brand colour
            // (innergathering's gold is 2.68:1 on its paper, under the 3:1 a
            // control needs). --sf-fg / --sf-muted are text tokens, so they
            // clear 3:1 wherever the host's text does.
            (cell.on
              ? "border-[color:var(--sf-fg)] bg-[color:var(--sf-fg)]"
              : "border-[color:var(--sf-muted)] bg-[color:var(--sf-bg)]")
          }
        >
          <span
            aria-hidden
            className={
              "inline-block h-4 w-4 rounded-full transition-transform " +
              (cell.on ? "translate-x-[1.3rem] bg-[color:var(--sf-bg)]" : "translate-x-[0.15rem] bg-[color:var(--sf-muted)]")
            }
          />
        </button>
        <span className="text-[0.85rem]">{cell.on ? "Shown" : "Hidden"}</span>
        {note}
      </span>
    );
  }

  function columnHead(column: SurfacePresenceColumn) {
    return column.href ? (
      <a className="underline underline-offset-2" href={column.href} target="_blank" rel="noopener">
        {column.label}
      </a>
    ) : (
      column.label
    );
  }

  function presencePanel() {
    if (!presence || presence.rows.length === 0) return null;
    const { columns, rows } = presence;
    return (
      <div className="grid gap-4">
        <p className="text-[0.9rem] text-[color:var(--sf-muted)]">
          Switches work at once. Showing on an organisation’s site is its organisers’ call — you can hide yourself any
          time, and ask to be shown.
        </p>

        {/* Wide: the matrix. */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className="w-[8.5rem]" />
                {columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className="border-b border-[color:var(--sf-line)] px-2 pb-2 align-bottom text-[0.8rem] font-semibold"
                  >
                    {columnHead(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-[color:var(--sf-line)] last:border-b-0">
                  <th scope="row" className="py-3 pr-2 align-top text-[0.9rem] font-semibold">
                    {row.label}
                  </th>
                  {columns.map((c) => {
                    const cell = row.cells[c.key];
                    return (
                      <td key={c.key} className="px-2 py-3 align-top">
                        {cell ? presenceCell(row, c, cell) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phone: one group per row, only the places that apply. */}
        <div className="grid gap-5 sm:hidden">
          {rows.map((row) => (
            <section key={row.key} aria-label={row.label}>
              <h3 className="mb-1 text-[0.95rem] font-semibold">{row.label}</h3>
              <ul className="m-0 list-none p-0">
                {columns
                  .filter((c) => row.cells[c.key])
                  .map((c) => (
                    <li
                      key={c.key}
                      className="flex items-start justify-between gap-3 border-b border-[color:var(--sf-line)] py-2 last:border-b-0"
                    >
                      <span className="min-w-0 pt-0.5 text-[0.9rem]">{columnHead(c)}</span>
                      <span className="shrink-0">{presenceCell(row, c, row.cells[c.key]!)}</span>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    );
  }

  function pagePanel(inline: boolean, includePayouts: boolean = inline) {
    if (!page || page.sections.length === 0) return null;
    return (
      <section className={inline ? "eac-page-panel" : undefined}>
        {inline && <h3 className="eac-page-panel__head">What your page carries</h3>}
        <ul className="eac-page-sections">
          {page.sections.map((section) => (
            <li key={section.key}>
              {/* A basis, so on a phone a long "why not yet" wraps BELOW the
                  name instead of squeezing it to a word per line. */}
              <div className="eac-page-section__id" style={{ flexBasis: "13rem" }}>
                <strong>{section.label}</strong>
                {section.blurb && <em>{section.blurb}</em>}
              </div>

              {section.blockedReason ? (
                // A switch that silently refuses is worse than one that
                // says why it cannot be flipped yet.
                <span className="eac-page-section__blocked">{section.blockedReason}</span>
              ) : (
                <button
                  type="button"
                  className={"eac-btn" + (section.on ? "" : " eac-btn--primary")}
                  aria-pressed={section.on}
                  disabled={busyKey === section.key || !pageConnectors}
                  onClick={async () => {
                    if (!pageConnectors) return;
                    setBusyKey(section.key);
                    const result = await pageConnectors
                      .setSection(section.key, !section.on)
                      .catch(() => ({ ok: false as const, error: "Could not save that." }));
                    setBusyKey(null);
                    if (result.ok === false) return fail(result.error || "Could not save that.");
                    // Re-read rather than patch: the server decides
                    // whether a section really went on.
                    pageConnectors.load().then(setPage).catch(() => {});
                    connectors.onMutated?.();
                  }}
                >
                  {busyKey === section.key ? "…" : section.on ? "On" : "Turn on"}
                </button>
              )}
            </li>
          ))}
        </ul>
        {includePayouts && payoutsPanel(true)}
      </section>
    );
  }

  function payoutsPanel(inline = true) {
    if (!page?.payouts) return null;
    const p = page.payouts;
    // Only before an account exists — Stripe fixes the country at creation
    // and never changes it after, so this is the only moment to ask. Once
    // `state` is past "none" the account already has whatever country it
    // was given (right or wrong — see disconnectPayouts below for wrong).
    const needsCountry = p.available && p.state === "none" && !p.country && Boolean(pageConnectors?.startPayouts);
    return (
      // In its own tab there is nothing above it to rule off. Inline styles,
      // because surface.css is unlayered and outranks any Tailwind utility.
      <div className="eac-page-payouts" style={inline ? undefined : { marginTop: 0, borderTop: 0, paddingTop: 0 }}>
        <div className="eac-page-section__id">
          <strong>Getting paid</strong>
          <em>
            {!p.available
              ? "Card payments are not switched on for this platform yet."
              : p.state === "ready"
                ? `Connected${p.accountLabel ? ` — ${p.accountLabel}` : ""}. Sales reach you directly.`
                : p.state === "pending"
                  ? "Stripe has some of your details. Finish and you can be paid directly."
                  : "Connect a Stripe account and a sale pays you, not the platform."}
          </em>
        </div>

        {/* .eac-page-payouts is a wrapping flex ROW (label + one control,
            space-between) — every block below is wider than that pairing
            was built for, so each gets `basis-full shrink-0` to force its
            own line rather than shrinking to fit beside whatever's next to
            it (flex-basis:100% is what a wrapping flex line actually keys
            off; plain `w-full` still shrinks under its default flex-shrink
            of 1). The max-width goes on the SELECT, not this wrapper — put
            on the flex item itself, Chrome uses the clamped width as the
            line-fit size and the wrap never happens at all. */}
        {needsCountry && (
          <label className="mt-2 grid basis-full shrink-0 gap-1">
            <span className={LABEL}>Where are you?</span>
            <select
              className={FIELD}
              style={{ maxWidth: "20rem" }}
              value={payoutCountry}
              onChange={(e) => setPayoutCountry(e.target.value)}
            >
              <option value="">Choose…</option>
              {PAYOUT_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className={HINT}>
              Stripe fixes your account to this country when it&rsquo;s created, and can never change it after — we
              ask once, before you connect.
            </span>
          </label>
        )}

        {p.available && p.state !== "ready" && pageConnectors?.startPayouts && (
          <button
            type="button"
            className="eac-btn eac-btn--primary"
            disabled={busyKey === "payouts" || (needsCountry && !payoutCountry)}
            onClick={async () => {
              setBusyKey("payouts");
              const result = await pageConnectors
                .startPayouts!(needsCountry ? payoutCountry : undefined)
                .catch(() => ({ ok: false as const, error: "Could not reach Stripe." }));
              setBusyKey(null);
              if (result.ok === false) return fail(result.error || "Could not reach Stripe.");
              window.location.assign(result.url);
            }}
          >
            {busyKey === "payouts" ? "…" : p.state === "pending" ? "Finish with Stripe" : "Connect Stripe"}
          </button>
        )}

        {/* The only way out of an account stuck with the wrong country —
            Stripe never lets it change, so starting over is the fix. Offered
            from "pending" or "ready": a "ready" account could just as well
            be one of the pre-fix accounts that finished onboarding under the
            platform's default country regardless of where its owner is. */}
        {p.state !== "none" && pageConnectors?.disconnectPayouts && (
          <button
            type="button"
            className="eac-btn eac-btn--quiet ml-2"
            disabled={busyKey === "payouts-disconnect"}
            onClick={async () => {
              setBusyKey("payouts-disconnect");
              const result = await pageConnectors
                .disconnectPayouts!()
                .catch(() => ({ ok: false as const, error: "Could not disconnect that." }));
              setBusyKey(null);
              if (result.ok === false) return fail(result.error || "Could not disconnect that.");
              setPayoutCountry("");
              pageConnectors.load().then(setPage).catch(() => {});
              connectors.onMutated?.();
            }}
          >
            {busyKey === "payouts-disconnect" ? "…" : "Start over with a new account"}
          </button>
        )}

        {/* What has actually moved for this person — under Getting paid, not
            instead of it: the connect control answers "can I be paid", this
            answers "has anything happened yet". */}
        {p.work && (() => {
          const work = p.work;
          return (
            <div className="mt-4 grid basis-full shrink-0 gap-3 border-t border-[color:var(--sf-line)] pt-4">
              <div className="eac-page-section__id">
                <strong>Your work</strong>
                <em>What has moved for you, and what you&rsquo;re owed.</em>
              </div>
              <dl className="grid grid-cols-3 gap-3 text-[0.85rem]">
                <div>
                  <dt className="text-[0.7rem] uppercase tracking-wide text-[color:var(--sf-muted)]">Payable</dt>
                  <dd className="m-0 font-semibold tabular-nums">{formatMoney(work.payableMinor, work.currency)}</dd>
                </div>
                <div>
                  <dt className="text-[0.7rem] uppercase tracking-wide text-[color:var(--sf-muted)]">Held</dt>
                  <dd className="m-0 tabular-nums">{formatMoney(work.heldMinor, work.currency)}</dd>
                </div>
                <div>
                  <dt className="text-[0.7rem] uppercase tracking-wide text-[color:var(--sf-muted)]">Total</dt>
                  <dd className="m-0 tabular-nums">{formatMoney(work.totalMinor, work.currency)}</dd>
                </div>
              </dl>
              {work.lines.length > 0 ? (
                <ul className="m-0 grid list-none gap-2 p-0">
                  {work.lines.map((line) => (
                    <li key={line.id} className="flex items-center justify-between gap-3 border-b border-[color:var(--sf-line)] pb-2 text-[0.85rem] last:border-b-0">
                      <span className="min-w-0 truncate">{line.label}</span>
                      <span className="shrink-0 tabular-nums text-[color:var(--sf-muted)]">
                        {line.held ? "Held · " : ""}
                        {formatMoney(line.amountMinor, work.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-[0.85rem] text-[color:var(--sf-muted)]">Nothing recorded yet.</p>
              )}
            </div>
          );
        })()}

        {p.onboarding && (
          <details className="group mt-4 basis-full shrink-0 rounded-[var(--sf-radius-sm)] border border-[color:var(--sf-line)] px-3 py-2">
            <summary className="cursor-pointer select-none text-[0.9rem] text-[color:var(--sf-fg)]">
              {p.onboarding.title}
            </summary>
            <div className="mt-3 grid gap-3 pb-1 text-[0.85rem] leading-relaxed text-[color:var(--sf-muted)]">
              {p.onboarding.paragraphs.map((para, i) => (
                <p key={i} className="m-0">
                  {linkify(para)}
                </p>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  }

  let body: React.ReactNode;
  if (current === "show")
    // Page's sections sit at the top: what your page carries is itself part
    // of where you show, and a member checking one now finds both without
    // hunting across tabs. Payouts stays out of it — that has its own tab.
    body = (
      <div className="grid gap-6">
        {pagePanel(true, false)}
        {presencePanel()}
      </div>
    );
  else if (current === "details") body = detailsForm;
  else if (current === "payouts") body = payoutsPanel(false);
  else
    body = (
      <div className="grid gap-4">
        {compactCard}
        {isEditing ? profileForm : profileView}
      </div>
    );

  return (
    <SurfaceFrame
      kind="neutral"
      title={profile.displayName}
      kicker={kicker}
      rail={rail}
      actions={actions}
      status={notice}
      statusTone={tone}
    >
      <div ref={rootRef} className="grid gap-4">
        {tabs.length > 1 && (
          <div
            role="tablist"
            aria-label="Your profile"
            className="sticky top-0 z-10 -mx-1 -mt-1 flex gap-2 overflow-x-auto bg-[color:var(--sf-bg)] px-0.5 pb-2 pt-1 [scrollbar-width:none]"
          >
            {tabs.map((t) => {
              const on = t === current;
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={`eac-profile-tab-${t}`}
                  aria-selected={on}
                  aria-controls="eac-profile-tabpanel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => selectTab(t)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                    e.preventDefault();
                    const i = tabs.indexOf(t) + (e.key === "ArrowRight" ? 1 : -1);
                    const next = tabs[(i + tabs.length) % tabs.length];
                    selectTab(next);
                    document.getElementById(`eac-profile-tab-${next}`)?.focus();
                  }}
                  // A row of scrollable tabs read as plain text with only an
                  // underline to say "click me" — easy to miss, especially
                  // scrolled halfway on a phone. Pill buttons give every tab
                  // its own edge, on or off.
                  className={
                    "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[0.85rem] font-medium transition-colors " +
                    (on
                      ? "border-[color:var(--sf-fg)] bg-[color:var(--sf-fg)] text-[color:var(--sf-bg)]"
                      : "border-[color:var(--sf-line)] text-[color:var(--sf-muted)] hover:border-[color:var(--sf-fg)] hover:text-[color:var(--sf-fg)]")
                  }
                >
                  {TAB_LABEL[t]}
                </button>
              );
            })}
          </div>
        )}
        <div
          id="eac-profile-tabpanel"
          role={tabs.length > 1 ? "tabpanel" : undefined}
          aria-labelledby={tabs.length > 1 ? `eac-profile-tab-${current}` : undefined}
        >
          {body}
        </div>
      </div>
    </SurfaceFrame>
  );
}

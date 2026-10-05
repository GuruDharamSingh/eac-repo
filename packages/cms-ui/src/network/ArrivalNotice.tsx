"use client";

import { useEffect, useState, type CSSProperties } from "react";

export interface ArrivalNoticeProps {
  /** This app's /api/network/arrival (createArrivalHandler in @elkdonis/auth-server), basePath included. */
  endpoint: string;
}

interface NoticeData {
  orgName: string;
  /** Where the person came from: an org name or a host. Null for a direct arrival. */
  fromLabel: string | null;
  /** Display name or email. */
  who: string;
  /** Null: not in the org. 'viewer': follows it. Anything else: a member. */
  role: string | null;
}

/** Cookie set by the handoff accept when an arrival was recorded. */
const ARRIVAL_COOKIE = "eac_arrival";

/**
 * Shown once after a person arrives signed in through the network SSO
 * handoff: says where they are and where they came from, and offers to
 * follow the org. Renders nothing, and fetches nothing, unless the handoff
 * left the `eac_arrival` cookie. Self-styled (inline, on --eac-control-*
 * tokens with fallbacks) so it drops into any app's root layout.
 */
export function ArrivalNotice({ endpoint }: ArrivalNoticeProps) {
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const [followed, setFollowed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!document.cookie.split("; ").some((c) => c.startsWith(`${ARRIVAL_COOKIE}=`) && c.length > ARRIVAL_COOKIE.length + 1)) return;
    let cancelled = false;
    fetch(endpoint, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { notice?: NoticeData | null } | null) => {
        if (!cancelled && body?.notice) setNotice(body.notice);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  if (!notice) return null;
  const { orgName, fromLabel, who, role } = notice;

  const send = async (action: "follow" | "dismiss") => {
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (action === "follow" && res.ok) {
        setFollowed(true);
        return;
      }
    } catch {
      /* the notice closes either way */
    } finally {
      setBusy(false);
    }
    setNotice(null);
  };

  const canFollow = role === null && !followed;
  const status = followed || role === "viewer" ? `You follow ${orgName}.` : role ? `You are a member of ${orgName}.` : null;

  return (
    <aside role="status" aria-label="Signed in through the network" style={box}>
      <p style={{ margin: 0 }}>
        Signed in as <strong>{who}</strong> through the Elkdonis network.
      </p>
      <p style={{ margin: "0.35rem 0 0", color: "var(--eac-control-muted, #555)" }}>
        You are on {orgName}
        {fromLabel ? `, arriving from ${fromLabel}` : ""}.{status ? ` ${status}` : ""}
      </p>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
        {canFollow && (
          <button type="button" disabled={busy} onClick={() => void send("follow")} style={primary}>
            Follow {orgName}
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => (followed ? setNotice(null) : void send("dismiss"))} style={secondary}>
          {canFollow ? "Not now" : "Close"}
        </button>
      </div>
    </aside>
  );
}

const box: CSSProperties = {
  position: "fixed",
  right: "1rem",
  bottom: "1rem",
  zIndex: 1000,
  maxWidth: "min(24rem, calc(100vw - 2rem))",
  padding: "1rem 1.1rem",
  background: "var(--eac-control-bg, #fff)",
  color: "var(--eac-control-fg, #1a1a1a)",
  border: "1px solid var(--eac-control-line, #d4d4d4)",
  borderRadius: "var(--eac-control-radius, 8px)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
  fontFamily: "var(--eac-control-font, inherit)",
  fontSize: "0.95rem",
  lineHeight: 1.45,
};

const buttonBase: CSSProperties = {
  minHeight: "2.25rem",
  padding: "0 0.9rem",
  borderRadius: "var(--eac-control-radius, 6px)",
  font: "inherit",
  cursor: "pointer",
};

const primary: CSSProperties = {
  ...buttonBase,
  background: "var(--eac-control-accent, #1a1a1a)",
  color: "var(--eac-control-accent-on, #fff)",
  border: "1px solid var(--eac-control-accent, #1a1a1a)",
};

const secondary: CSSProperties = {
  ...buttonBase,
  background: "transparent",
  color: "inherit",
  border: "1px solid var(--eac-control-line, #d4d4d4)",
};

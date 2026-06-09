"use client";

import { useState, useTransition } from "react";
import { claimDossier, vouchForDossier, reviewDossier, type ActionState } from "@/lib/oad-actions";

type Props = {
  slug: string;
  signedIn: boolean;
  isSteward: boolean;
  claimStatus: "unclaimed" | "pending" | "claimed";
  verified: boolean;
  vouchCount: number;
  alreadyVouched: boolean;
  loginUrl: string;
};

const bar: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 50,
  background: "#1a1a1a",
  borderTop: "2px solid #8c3b3b",
  color: "#f7f1e3",
  fontFamily: "'Courier Prime', 'Courier New', monospace",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.6rem",
  padding: "0.6rem 1rem",
  fontSize: 13,
};

const btn: React.CSSProperties = {
  background: "transparent",
  color: "#f7f1e3",
  border: "1px solid #5a5a52",
  padding: "0.4rem 0.9rem",
  letterSpacing: 1,
  textTransform: "uppercase",
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
};

const btnPrimary: React.CSSProperties = { ...btn, background: "#8c3b3b", borderColor: "#8c3b3b" };

export function DossierActions(props: Props) {
  const { slug, signedIn, isSteward, claimStatus, verified, vouchCount, alreadyVouched, loginUrl } = props;
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string>("");
  const [vouched, setVouched] = useState(alreadyVouched);
  const [count, setCount] = useState(vouchCount);
  const [claim, setClaim] = useState(claimStatus);
  const [isVerified, setIsVerified] = useState(verified);

  function run(fn: () => Promise<ActionState>, onOk?: () => void) {
    setMsg("");
    startTransition(async () => {
      const res = await fn();
      if (res.error) setMsg(res.error);
      else onOk?.();
    });
  }

  if (!signedIn) {
    return (
      <div style={bar}>
        <span style={{ opacity: 0.8 }}>This is a community file. </span>
        <a style={btnPrimary} href={loginUrl}>Sign in to contribute</a>
        <span style={{ opacity: 0.6, marginLeft: "auto" }}>
          {isVerified ? "● VERIFIED" : `● ${claim.toUpperCase()}`} · {count} vouch{count === 1 ? "" : "es"}
        </span>
      </div>
    );
  }

  return (
    <div style={bar}>
      <a style={btn} href={`/${slug}/edit`}>✎ Edit file</a>

      {claim === "unclaimed" && (
        <button style={btnPrimary} disabled={pending} onClick={() => run(() => claimDossier(slug), () => setClaim("pending"))}>
          Claim this file
        </button>
      )}
      {claim === "pending" && !isSteward && <span style={{ opacity: 0.8 }}>⧗ Claim pending review</span>}
      {claim === "pending" && isSteward && (
        <button style={btnPrimary} disabled={pending} onClick={() => run(() => reviewDossier(slug, "approve_claim"), () => setClaim("claimed"))}>
          Approve claim
        </button>
      )}
      {claim === "claimed" && <span style={{ opacity: 0.8 }}>✓ Claimed</span>}

      <button
        style={vouched ? btn : btnPrimary}
        disabled={pending || vouched}
        onClick={() => run(() => vouchForDossier(slug), () => { setVouched(true); setCount((c) => c + 1); })}
      >
        {vouched ? `✓ Vouched · ${count}` : `Vouch · ${count}`}
      </button>

      {isSteward && (
        isVerified ? (
          <button style={btn} disabled={pending} onClick={() => run(() => reviewDossier(slug, "unverify"), () => setIsVerified(false))}>
            Unverify
          </button>
        ) : (
          <button style={btn} disabled={pending} onClick={() => run(() => reviewDossier(slug, "verify"), () => setIsVerified(true))}>
            ✓ Verify (steward)
          </button>
        )
      )}

      <span style={{ opacity: 0.6, marginLeft: "auto" }}>
        {isVerified ? "● VERIFIED" : `● ${claim.toUpperCase()}`}
      </span>
      {msg && <span style={{ color: "#e08a8a", width: "100%" }}>{msg}</span>}
    </div>
  );
}

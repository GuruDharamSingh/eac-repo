"use client";

import * as React from "react";

// ============================================================================
// "Payment was cancelled": the line an offer layer shows when the buyer comes back from a
// cancelled card page. Checkout (packages/content server/checkout.ts) sends them to
// `?surface=offer:<svc|evt|art>-offer:<key>&payment=cancelled`; the offer layer opens from the
// surface param as for any deep link, and this reads `payment=cancelled` once, then removes it
// from the address so a reload or a later layer does not repeat it. Added by lane P, 2026-11-27.
// ============================================================================

const CancelledContext = React.createContext(false);

/** Read `payment=cancelled` from the address (browser only). */
function readCancelled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URL(window.location.href).searchParams.get("payment") === "cancelled";
  } catch {
    return false;
  }
}

/** Wrap an offer layer (evt-offer, svc-offer, art-offer): its frame then shows the line when the page was opened after a cancel. */
export function PaymentCancelledScope({ children }: { children: React.ReactNode }) {
  const [cancelled] = React.useState(readCancelled);
  React.useEffect(() => {
    if (!cancelled) return;
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get("payment") !== "cancelled") return;
      u.searchParams.delete("payment");
      window.history.replaceState(window.history.state, "", u.toString());
    } catch {
      /* the line still shows; the param just stays */
    }
  }, [cancelled]);
  return <CancelledContext.Provider value={cancelled}>{children}</CancelledContext.Provider>;
}

/** Drawn at the top of a frame's body; renders nothing outside a PaymentCancelledScope that saw a cancel. */
export function PaymentCancelledNote() {
  if (!React.useContext(CancelledContext)) return null;
  return (
    <p className="osf-note" role="status">
      Payment was cancelled.
    </p>
  );
}

"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[katie-the-potter] page error:", error);
  }, [error]);

  return (
    <div className="ktp-page">
      <h1>Something went wrong</h1>
      <p>{error.message || "An unexpected error occurred."}</p>
      {error.digest && <p style={{ fontSize: "0.8rem" }}>Reference: {error.digest}</p>}
      <button type="button" onClick={reset} className="ktp-btn ktp-btn--ghost">
        Try again
      </button>
    </div>
  );
}

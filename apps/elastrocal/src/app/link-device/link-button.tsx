"use client";

import { useState } from "react";
import { linkDevice } from "./actions";

export function LinkButton({ app, label, state }: { app: string; label: string; state: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const r = await linkDevice(app, label, state);
    setBusy(false);
    if (r.error || !r.url) return setError(r.error ?? "Could not link");
    setUrl(r.url);
    // Back to the app; the link below stays in case the browser asks first.
    window.location.href = r.url;
  }

  return (
    <div className="mt-6">
      {url ? (
        <a href={url} className="inline-block rounded-md bg-neutral-900 px-5 py-3 text-white">
          Open the app
        </a>
      ) : (
        <button onClick={go} disabled={busy} className="rounded-md bg-neutral-900 px-5 py-3 text-white disabled:opacity-50">
          {busy ? "Linking…" : "Link"}
        </button>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}

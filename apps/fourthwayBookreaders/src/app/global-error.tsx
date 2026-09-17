"use client";

import "./globals.css";

/**
 * Last-resort error boundary. When something throws above the root layout,
 * Next unmounts it and renders this — so it produces its own <html>/<body>,
 * and none of the site's header or fonts exist here.
 *
 * Two rules, same as every app in the repo: no components, hooks or packages
 * (whatever broke may break again here), and styling only from globals.css,
 * a static asset that cannot throw.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 32 }}>
        <main style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.6rem", marginBottom: 12 }}>The page fell shut</h1>
          <p style={{ marginBottom: 20 }}>
            Something went wrong loading this. Try again, and if it keeps
            happening, let us know.
          </p>
          {error.digest && (
            <p className="eyebrow" style={{ marginBottom: 20 }}>Reference: {error.digest}</p>
          )}
          <button type="button" className="btn btn--primary" onClick={reset}>Try again</button>
          <p style={{ marginTop: 20 }}><a href="/">Back to the front page</a></p>
        </main>
      </body>
    </html>
  );
}

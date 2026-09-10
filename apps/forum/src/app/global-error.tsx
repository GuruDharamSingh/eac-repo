"use client";

/**
 * Last-resort error boundary.
 *
 * When something throws above the root layout, Next unmounts that layout and
 * renders this instead — so it has to produce its own <html> and <body>, and
 * none of the site's providers, fonts or header exist here. (Next also
 * prerenders it at build time as `/_global-error`.)
 *
 * Every app carries the same file, in its own palette. Two rules keep it from
 * breaking in the exact moment it is needed:
 *
 *   1. No components, hooks or packages: whatever broke may be the thing that
 *      would break again here. Plain elements only.
 *   2. Styling comes from globals.css — a static asset that cannot throw —
 *      but this app has no Tailwind, so the same look is written inline.
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
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#111114",
          color: "#ecebe6",
          fontFamily: "Georgia, 'Times New Roman', serif",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 400, marginBottom: "0.75rem" }}>Something went wrong</h1>
          <p style={{ lineHeight: 1.7, marginBottom: "1.5rem", opacity: 0.8 }}>
            The page couldn&rsquo;t load. Try again, and if it keeps happening let us know.
          </p>
          {error.digest && (
            <p style={{ fontSize: "0.8rem", opacity: 0.5, marginBottom: "1.5rem" }}>Reference: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              background: "transparent",
              color: "#ecebe6",
              border: "1px solid rgba(236, 235, 230, 0.4)",
              borderRadius: "6px",
              padding: "0.55rem 1.4rem",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <p style={{ marginTop: "1.5rem" }}>
            <a href="/" style={{ color: "#d6b35a" }}>Back to the home page</a>
          </p>
        </main>
      </body>
    </html>
  );
}

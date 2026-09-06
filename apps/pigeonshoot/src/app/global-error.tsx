"use client";

/**
 * Last-resort error boundary — replaces the root layout entirely when
 * something throws above it, so it has to render its own <html> and <body>
 * and cannot use any of the site's providers or fonts.
 *
 * Deliberately dependency-free, with inline styles: whatever broke may well
 * be the thing that would break again here.
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
          backgroundColor: "#FDF5E6",
          color: "#36454F",
          fontFamily: "Georgia, serif",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>
            Something went wrong
          </h1>
          <p style={{ lineHeight: 1.6, marginBottom: "1.5rem" }}>
            The page couldn&rsquo;t load. Try again, and if it keeps happening let us know.
          </p>
          {error.digest && (
            <p style={{ fontSize: "0.8rem", opacity: 0.6, marginBottom: "1.5rem" }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#E6B422",
              color: "#36454F",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.6rem 1.4rem",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <p style={{ marginTop: "1.5rem" }}>
            <a href="/" style={{ color: "#D16B47" }}>
              Back to the home page
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}

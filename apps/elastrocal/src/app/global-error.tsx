"use client";

import "./globals.css";

/**
 * Last-resort error boundary (renders in place of the root layout, so it
 * brings its own <html>/<body>). Same rules as every app's copy: plain
 * elements only, styled from globals.css on the site's own tokens.
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
      <body className="m-0 flex min-h-screen items-center justify-center bg-background p-8 text-foreground antialiased">
        <main className="max-w-lg text-center">
          <h1 className="mb-3 text-2xl font-medium tracking-tight">Something went wrong</h1>
          <p className="mb-6 leading-relaxed text-muted-foreground">
            The page couldn&rsquo;t load. Try again, and if it keeps happening let us know.
          </p>
          {error.digest && <p className="mb-6 text-xs text-muted-foreground/70">Reference: {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-border bg-transparent px-5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            Try again
          </button>
          <p className="mt-6">
            <a href="/" className="text-primary underline underline-offset-4">
              Back to the sky
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}

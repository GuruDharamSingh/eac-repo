"use client";

import "./globals.css";

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
 *      Tailwind utilities on the site's own tokens (background, foreground,
 *      primary), so the page still looks like this site while it apologises.
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
          {error.digest && (
            <p className="mb-6 text-xs text-muted-foreground/70">Reference: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-border bg-transparent px-5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            Try again
          </button>
          <p className="mt-6">
            <a href="/" className="text-primary underline underline-offset-4">
              Back to the home page
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}

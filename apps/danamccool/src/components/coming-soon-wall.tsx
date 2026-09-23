import Link from "next/link";
import { siteConfig } from "@/config/site";

/**
 * The whole site behind a single "in progress" screen — no nav, no footer,
 * nothing to click through to. `/login` renders inside this same shell (see
 * layout.tsx) so an owner or admin can still get in; everyone else gets the
 * message and a sign-in link, never the real pages underneath.
 *
 * Deliberately not `dm-*` site.css — those rules assume the fixed sidebar
 * layout this screen is standing in for. Plain CSS vars off site.css's own
 * `:root` (`--violet`, `--ink`), so it stays on-brand without depending on
 * the sidebar chrome.
 */
export function ComingSoonWall({ children }: { children?: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        background: "var(--violet)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "26rem",
          background: "#fff",
          color: "var(--ink)",
          borderRadius: "0.75rem",
          padding: "2.5rem 2rem",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo-uranus.png"
          alt={siteConfig.orgName}
          style={{ height: "2.5rem", width: "auto", margin: "0 auto 1.5rem" }}
        />
        {children ?? (
          <>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              {siteConfig.orgName}&rsquo;s site is in progress
            </h1>
            <p style={{ fontSize: "0.9rem", opacity: 0.75, marginBottom: "1.75rem" }}>
              We&rsquo;re still building this one — check back soon.
            </p>
            <Link
              // `sso=1` skips /login's silent cross-domain handoff check (a
              // redirect out to elkdonis-arts.org and back) — this link goes
              // straight to the plain sign-in form. The handoff is a nice-to-
              // have for someone already signed in elsewhere on the network;
              // it's also one more moving part on a domain whose DNS/cert are
              // still settling, and every account that matters here (Dana,
              // admins) can just sign in directly.
              href="/login?sso=1"
              style={{
                display: "inline-block",
                padding: "0.6rem 1.5rem",
                borderRadius: "0.5rem",
                background: "var(--violet)",
                color: "#fff",
                fontSize: "0.85rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

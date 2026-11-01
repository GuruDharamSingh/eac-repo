import type { ReactNode } from "react";
import { defaultSiteContent } from "@/lib/default-content";

/* A row of social and email icons for the landing's IFAC section and the
   public footer (developer, 2026-10-10). Links from default-content.ts
   footer.links ("IFAC on …") plus the footer email. Line icons in the site's stroke style (icons.tsx), not brand
   marks: simple shapes that read at 22px on the dark page. */

const GLYPHS: Record<string, ReactNode> = {
  Facebook: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M15.5 7.5h-1.8a2.2 2.2 0 0 0-2.2 2.2V21M9 13h6" /></>,
  Bluesky: (
    <path d="M12 11.2C10.6 8.4 7.6 5.5 5.3 5.5 4 5.5 3.6 6.4 3.6 7.6c0 2.3 1 5 4.1 5.3-2.4.6-3 2.4-1.6 3.8 2 2 4.4-.4 5.9-3.4 1.5 3 3.9 5.4 5.9 3.4 1.4-1.4.8-3.2-1.6-3.8 3.1-.3 4.1-3 4.1-5.3 0-1.2-.4-2.1-1.7-2.1-2.3 0-5.3 2.9-6.7 5.7z" />
  ),
  Threads: <><circle cx="12" cy="12" r="3.6" /><path d="M15.6 12v1.4a2.6 2.6 0 0 0 5.2 0V12a8.8 8.8 0 1 0-3.4 6.9" /></>,
  "X (Twitter)": <path d="M4.5 4h4.2l10.8 16h-4.2zM19.5 4l-6.2 7M4.5 20l6.2-7" />,
  Instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="0.6" /></>,
  YouTube: <><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="M10.2 9.2v5.6l4.8-2.8z" /></>,
  Email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5l8.5 6.5 8.5-6.5" /></>,
};

/** `variant="footer"`: the same row on its own line under the footer nav (round 3, 2026-10-10). */
export function SocialRow({ variant }: { variant?: "footer" } = {}) {
  const footer = defaultSiteContent.footer;
  const links = footer.links
    .filter((l) => /^IFAC on /.test(l.label))
    .map((l) => ({ name: l.label.replace(/^IFAC on /, ""), href: l.href, external: true }));
  links.push({ name: "Email", href: `mailto:${footer.email}`, external: false });
  return (
    <ul className={`ifs-social${variant === "footer" ? " ifs-social--footer" : ""}`} aria-label="IFAC elsewhere">
      {links.map((l) => (
        <li key={l.href}>
          <a
            href={l.href}
            aria-label={l.name === "Email" ? "Email IFAC" : `IFAC on ${l.name}`}
            title={l.name === "Email" ? "Email IFAC" : l.name}
            {...(l.external ? { target: "_blank", rel: "noopener" } : {})}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">{GLYPHS[l.name] ?? <circle cx="12" cy="12" r="8" />}</svg>
          </a>
        </li>
      ))}
    </ul>
  );
}

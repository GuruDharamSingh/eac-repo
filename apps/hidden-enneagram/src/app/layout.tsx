import type { Metadata, Viewport } from "next";
import { listOrgFeeds } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { HubSurfaces } from "@/components/hub/HubSurfaces";
import "./globals.css";

// Fonts are loaded via a CSS @import in globals.css (browser-side) rather than
// next/font/google, which downloads at build time and fails in the offline
// container. The published site brings its own @import for the same families.

export const metadata: Metadata = {
  title: "The Hidden Enneagram",
  description:
    "Formative developmental imprints — a map of how core motivations become recurring psychological fixations. Typing sessions, consultations, and study.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer().catch(() => null);
  const canEdit = Boolean(viewer?.canEdit);

  // Editors compose into private feeds too; visitors only see public ones.
  const feeds = await listOrgFeeds(siteConfig.orgId, {
    includePrivate: canEdit,
  }).catch(() => []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Browser-side font load (container has no build-time internet). */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=EB+Garamond:wght@400;500&display=swap"
        />
      </head>
      <body className="antialiased">
        {/* One surface system for the whole site: a listing card on a feed
            page and a hub tile open into the same dialog. */}
        <HubSurfaces
          signedIn={Boolean(viewer)}
          userId={viewer?.userId ?? null}
          canEdit={canEdit}
          displayName={viewer?.email.split("@")[0] ?? null}
          feeds={feeds.map((f) => ({ slug: f.slug, name: f.name }))}
        >
          {children}
        </HubSurfaces>
      </body>
    </html>
  );
}

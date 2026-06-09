import type { Metadata, Viewport } from "next";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Browser-side font load (container has no build-time internet). */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=EB+Garamond:wght@400;500&display=swap"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}

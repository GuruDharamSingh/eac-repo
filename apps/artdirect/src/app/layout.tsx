import type { Metadata } from "next";
import "./globals.css";
import "./artdirect.css";
import { AnalyticsBeacon } from "@elkdonis/analytics/beacon";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  title: "ArtDirect — the open artist directory",
  description:
    "ArtDirect is an open, community-built directory of artists — a commons of the Arts Collective network. Anyone can open a file; artists can claim and verify their own.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
        <AnalyticsBeacon />
      </body>
    </html>
  );
}

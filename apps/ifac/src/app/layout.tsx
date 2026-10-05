import { AnalyticsBeacon } from "@elkdonis/analytics/beacon";
import type { Metadata } from "next";
import "./globals.css";
import "@elkdonis/cms-ui/gallery.css";
import { siteConfig } from "@/config/site";
import { ArrivalNotice } from "@elkdonis/cms-ui/network";

export const metadata: Metadata = {
  title: `${siteConfig.shortName} | ${siteConfig.orgName}`,
  description: siteConfig.tagline,
  icons: {
    icon: "https://ifacgroup.com/images/favicon.ico",
    shortcut: "https://ifacgroup.com/images/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ArrivalNotice endpoint="/api/network/arrival" />
        <AnalyticsBeacon />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "@/config/site";

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
      <body>{children}</body>
    </html>
  );
}

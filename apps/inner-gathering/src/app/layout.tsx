import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";
import "@elkdonis/ui/eac-theme.css";
import "./globals.css";
import localFont from "next/font/local";
import { ColorSchemeScript } from "@mantine/core";
import type { Metadata, Viewport } from "next";
import { EacAtmosphere } from "@elkdonis/ui";

const basteleur = localFont({
  src: [
    { path: "../../public/fonts/Basteleur-Bold.woff2", weight: "700", style: "normal" },
    { path: "../../public/fonts/Basteleur-Bold.woff",  weight: "700", style: "normal" },
    { path: "../../public/fonts/Basteleur-Moonlight.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Basteleur-Moonlight.woff",  weight: "400", style: "normal" },
  ],
  variable: "--font-basteleur",
  display: "swap",
});

export const metadata: Metadata = {
  title: "InnerGathering",
  description: "Mobile-first community platform for spiritual gatherings",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
      </head>
      <body className={`${basteleur.variable}`} suppressHydrationWarning>
        <EacAtmosphere>{children}</EacAtmosphere>
      </body>
    </html>
  );
}

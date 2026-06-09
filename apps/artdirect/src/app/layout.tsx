import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArtDirect — the open artist directory",
  description:
    "ArtDirect is an open, community-built directory of artists — a commons of the Elkdonis network. Anyone can open a file; artists can claim and verify their own.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

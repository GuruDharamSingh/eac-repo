import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "InnerGathering",
  description: "Mobile-first community platform for spiritual gatherings",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider
          theme={{
            primaryColor: "indigo",
            fontFamily: "system-ui, -apple-system, sans-serif",
            defaultRadius: "md",
          }}
        >
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}

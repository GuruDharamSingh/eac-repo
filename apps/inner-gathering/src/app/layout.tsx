import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";
import "./globals.css";
import { ColorSchemeScript, MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import type { Metadata, Viewport } from "next";
import { LayoutWrapper } from "@/components/layout-wrapper";

const theme = createTheme({
  primaryColor: 'ember',
  fontFamily: "'Crimson Text', Georgia, 'Times New Roman', serif",
  headings: {
    fontFamily: "'Cinzel', 'Palatino Linotype', Palatino, serif",
    fontWeight: '700',
  },
  defaultRadius: 'sm',
  colors: {
    ember: [
      '#fff8f0', '#ffecd8', '#ffd4ad', '#ffb67a', '#ff9042',
      '#e8700f', '#d45c08', '#b04706', '#8c3705', '#6a2804',
    ] as any,
    archive: [
      '#fffaf0', '#f7ebcf', '#ecd5a9', '#d7b26e', '#c8910a',
      '#a97408', '#845707', '#5a3216', '#3d1f0a', '#1b1009',
    ] as any,
    moss: [
      '#f3f5ed', '#e1e7d4', '#c8d1ae', '#a5b47b', '#7d8f56',
      '#637443', '#52643a', '#3e4c2d', '#2d3821', '#1f2718',
    ] as any,
    oxblood: [
      '#fff2ee', '#f2d3cb', '#e3aaa0', '#c97467', '#a74639',
      '#8b3026', '#70251c', '#591b15', '#42130f', '#2a0c09',
    ] as any,
  },
  components: {
    Paper: {
      defaultProps: {
        bg: '#fffcf4',
      },
    },
    Badge: {
      defaultProps: {
        radius: 'xs',
      },
    },
  },
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Text:ital,wght@0,400;0,600;1,400;1,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <MantineProvider theme={theme}>
          <Notifications position="top-right" />
          <LayoutWrapper>{children}</LayoutWrapper>
        </MantineProvider>
      </body>
    </html>
  );
}

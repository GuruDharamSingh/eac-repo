import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";
import "@elkdonis/ui/eac-theme.css";
import "./globals.css";
import { ColorSchemeScript, MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import type { Metadata, Viewport } from "next";
import { EacAtmosphere } from "@elkdonis/ui";
import { LayoutWrapper } from "@/components/layout-wrapper";

const theme = createTheme({
  primaryColor: 'eacSky',
  fontFamily: "'Crimson Text', Georgia, 'Times New Roman', serif",
  headings: {
    fontFamily: "'Cinzel', 'Palatino Linotype', Palatino, serif",
    fontWeight: '700',
  },
  defaultRadius: 'sm',
  colors: {
    eacSky: [
      '#f4f7ff', '#dce6ff', '#b8caf5', '#86a2dd', '#5278bd',
      '#104b8C', '#063179', '#022278', '#01124E', '#020a2f',
    ] as any,
    mutedGold: [
      '#fffdf8', '#f7f1df', '#eadcb8', '#d6c38e', '#c3ad6a',
      '#b79a55', '#9f8444', '#8f763c', '#705b2b', '#473918',
    ] as any,
    archive: [
      '#fffdf8', '#fbf7ef', '#f3eadc', '#e5d8bf', '#d6c38e',
      '#b79a55', '#8f763c', '#104b8C', '#063179', '#022278',
    ] as any,
    moss: [
      '#f6f7f4', '#e9ece5', '#d4dbd1', '#b3c0b0', '#8fa08c',
      '#738270', '#64726a', '#4f5d54', '#374238', '#222b25',
    ] as any,
    oxblood: [
      '#faf7f2', '#eee5d6', '#d8c7a9', '#bea574', '#a99055',
      '#8f763c', '#745f33', '#5b4c31', '#3f372b', '#25231e',
    ] as any,
  },
  components: {
    Paper: {
      defaultProps: {
        bg: '#fffdf8',
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
        <EacAtmosphere>
          <MantineProvider theme={theme}>
            <Notifications position="top-right" />
            <LayoutWrapper>{children}</LayoutWrapper>
          </MantineProvider>
        </EacAtmosphere>
      </body>
    </html>
  );
}

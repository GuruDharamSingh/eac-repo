import "@mantine/core/styles.css";
import "@elkdonis/ui/eac-theme.css";
import "./globals.css";
import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { EacAtmosphere } from "@elkdonis/ui";

const venture = localFont({
  src: "../../public/fonts/Venture-nRqOR.otf",
  display: "swap",
  variable: "--font-venture",
});

export const metadata: Metadata = {
  title: "Elkdonis Arts Collective",
  description:
    "Performance and visual arts group working to restore the necessity of art in life for all.",
  keywords: [
    "fourth way",
    "objective art",
    "mutual aid",
    "spiritual growth",
    "paratheatre",
    "arts collective",
  ],
  openGraph: {
    title: "Elkdonis Arts Collective",
    description: "Performance and visual arts group working to restore the necessity of art in life for all.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body className={venture.variable} suppressHydrationWarning>
        <EacAtmosphere>
          <MantineProvider
            defaultColorScheme="dark"
            theme={{
              primaryColor: "eacSky",
              colors: {
                eacSky: [
                  "#f4f7ff",
                  "#dce6ff",
                  "#b8caf5",
                  "#86a2dd",
                  "#5278bd",
                  "#104b8C",
                  "#063179",
                  "#022278",
                  "#01124E",
                  "#020a2f",
                ],
              },
              fontFamily: 'var(--font-venture), "Venture", serif',
              headings: {
                fontFamily: 'var(--font-venture), "Venture", serif',
              },
              defaultRadius: "md",
            }}
          >
            {children}
          </MantineProvider>
        </EacAtmosphere>
      </body>
    </html>
  );
}

import "@mantine/core/styles.css";
import "./globals.css";
import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Elkdonis Arts Collective | Fourth-Way Mutual Aid Society",
  description:
    "A Fourth-Way Mutual Aid Society. Performance and visual arts group working to restore the necessity of art in life for all.",
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
    description: "A Fourth-Way Mutual Aid Society for objective artists",
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <MantineProvider
          defaultColorScheme="dark"
          theme={{
            primaryColor: "violet",
            fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
            headings: {
              fontFamily:
                '"Cormorant Garamond", Georgia, "Times New Roman", serif',
            },
            defaultRadius: "md",
            colors: {
              dark: [
                "#C1C2C5",
                "#A6A7AB",
                "#909296",
                "#5c5f66",
                "#373A40",
                "#2C2E33",
                "#25262b",
                "#1A1B1E",
                "#141517",
                "#101113",
              ],
            },
          }}
        >
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}

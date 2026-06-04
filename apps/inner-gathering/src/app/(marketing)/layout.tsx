import localFont from "next/font/local";
import { MantineProvider } from "@mantine/core";
import SiteNav from "@/components/marketing/SiteNav";
import "./marketing-globals.css";

const venture = localFont({
  src: "../../../public/fonts/Venture-nRqOR.otf",
  display: "swap",
  variable: "--font-venture",
});

const brothers = localFont({
  src: "../../../public/fonts/BrothersTypeface-Regular.otf",
  display: "swap",
  variable: "--font-brothers",
});

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${venture.variable} ${brothers.variable} marketing-root`}>
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
        <SiteNav />
        {children}
      </MantineProvider>
    </div>
  );
}

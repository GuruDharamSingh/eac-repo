import '@mantine/core/styles.css';
import './globals.css';
import { ColorSchemeScript } from '@mantine/core';
import { Cormorant_Garamond, Cinzel } from 'next/font/google';
import { BlogHeader, BlogProviders } from '@elkdonis/blog-client';
import { checkBlogOwner } from '@elkdonis/blog-server';
import { blogConfig } from '../config/blog';
import { sunjayTheme } from '../lib/theme';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant',
});

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cinzel',
});

export const metadata = {
  title: "Sunjay's Blog - Art, Healing & Conscious Creativity",
  description: 'Rock balancing, Qi Gong, Sufi practices, and conscious creative exploration by Jason Ford',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if current user is blog owner (non-throwing)
  const ownerContext = await checkBlogOwner(blogConfig);
  const isOwner = !!ownerContext;

  return (
    <html lang="en" suppressHydrationWarning data-mantine-color-scheme="dark">
      <head>
        <ColorSchemeScript forceColorScheme="dark" />
      </head>
      <body className={`${cormorant.variable} ${cinzel.variable}`} suppressHydrationWarning>
        <BlogProviders theme={sunjayTheme}>
          {/* Medieval Curtain Panels */}
          <div className="curtain-left" aria-hidden="true" />
          <div className="curtain-right" aria-hidden="true" />
          
          <div className="relative min-h-screen sacred-bg content-wrapper">
            <BlogHeader config={blogConfig} isOwner={isOwner} />
            <main className="relative z-10">
              <div className="mx-auto px-6 py-10 md:px-12 lg:px-16 max-w-5xl">
                {children}
              </div>
            </main>
            <footer className="relative z-10 border-t border-[rgba(201,162,39,0.15)] py-10">
              <div className="container mx-auto flex flex-col gap-3 px-4 text-sm text-[#9090a0] md:flex-row md:items-center md:justify-between">
                <p>© {new Date().getFullYear()} Jason Ford / Sunjay. All teachings remain sacred.</p>
                <div className="flex gap-6">
                  <a className="transition hover:text-[#c9a227]" href="mailto:info@elkdonis.org">
                    Contact
                  </a>
                </div>
              </div>
            </footer>
          </div>
        </BlogProviders>
      </body>
    </html>
  );
}

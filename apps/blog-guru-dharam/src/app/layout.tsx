import '@mantine/core/styles.css';
import './globals.css';
import { ColorSchemeScript } from '@mantine/core';
import { Geist, Geist_Mono } from 'next/font/google';
import { BlogProviders } from '@elkdonis/blog-client';
import { getServerSession } from '@elkdonis/auth-server';
import { SiteHeader } from '../components/site-header';
import { Hero } from '../components/hero';
import { blogConfig } from '../config/blog';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata = {
  title: "Guru Dharam's Blog",
  description: 'Thoughts, writings, and creative explorations',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  const isAuthenticated = Boolean(session.user);

  return (
    <html lang="en">
      <head>
        <ColorSchemeScript />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground`}>
        <BlogProviders>
          <div className="relative min-h-screen overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_45%)]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(248,196,113,0.16),_transparent_50%)]"
            />
            <SiteHeader config={blogConfig} isAuthenticated={isAuthenticated} />
            <main className="relative z-10">
              <section className="container mx-auto px-4 py-10">
                <Hero hero={blogConfig.hero} orgName={blogConfig.orgName} />
                <div className="mt-10">{children}</div>
              </section>
            </main>
            <footer className="relative z-10 border-t border-border/70 bg-background/90 py-10">
              <div className="container mx-auto flex flex-col gap-3 px-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                <p>© {new Date().getFullYear()} {blogConfig.orgName}. All teachings remain the work of their respective authors.</p>
                <div className="flex gap-6">
                  <a className="transition hover:text-foreground" href="mailto:info@elkdonis.org">
                    Contact
                  </a>
                  <a className="transition hover:text-foreground" href="https://elkdonis.org" target="_blank" rel="noreferrer">
                    Elkdonis Arts Collective
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

import '@mantine/core/styles.css';
import { ColorSchemeScript } from '@mantine/core';
import { cookies } from 'next/headers';
import { BlogHeader, BlogHero, BlogProviders } from '@elkdonis/blog-client';
import { getServerAuth } from '@elkdonis/auth-server';
import { blogConfig } from '../config/blog';

export const metadata = {
  title: "Sunjay's Blog",
  description: 'Personal blog and creative works',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = getServerAuth(cookies);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <html lang="en">
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <BlogProviders initialSession={session}>
          <BlogHeader config={blogConfig} />
          <main className="bg-slate-50">
            <div className="container mx-auto px-4 py-10">
              <BlogHero hero={blogConfig.hero} />
              <div className="mt-8">{children}</div>
            </div>
          </main>
        </BlogProviders>
      </body>
    </html>
  );
}

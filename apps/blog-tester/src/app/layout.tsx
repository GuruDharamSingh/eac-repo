import '@mantine/core/styles.css';
import './globals.css';
import { ColorSchemeScript } from '@mantine/core';
import { Inter, Merriweather } from 'next/font/google';
import { BlogHeader, BlogProviders } from '@elkdonis/blog-client';
import { checkBlogOwner } from '@elkdonis/blog-server';
import { blogConfig } from '../config/blog';
import { minimalTheme } from '../lib/theme';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const merriweather = Merriweather({
  weight: ['300', '400', '700', '900'],
  subsets: ['latin'],
  variable: '--font-serif',
});

export const metadata = {
  title: "BlogTester",
  description: 'A classic minimalist 2010s blog experience',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ownerContext = await checkBlogOwner(blogConfig);
  const isOwner = !!ownerContext;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
      </head>
      <body className={`${inter.variable} ${merriweather.variable} font-sans`} suppressHydrationWarning>
        <BlogProviders theme={minimalTheme}>
          <div className="min-h-screen flex flex-col">
            <BlogHeader config={blogConfig} isOwner={isOwner} />
            <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12">
              {children}
            </main>
            <footer className="border-t border-gray-200 dark:border-gray-800 py-8 mt-12">
              <div className="max-w-3xl mx-auto px-6 flex justify-between items-center text-sm text-gray-500">
                <p>© {new Date().getFullYear()} BlogTester.</p>
                <div className="flex gap-4">
                  <a className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors" href="#">Twitter</a>
                  <a className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors" href="#">RSS</a>
                </div>
              </div>
            </footer>
          </div>
        </BlogProviders>
      </body>
    </html>
  );
}

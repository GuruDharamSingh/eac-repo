import type { Metadata } from 'next';
import { Crimson_Pro, Inter } from 'next/font/google';
import './globals.css';
import { TopNav } from '@/components/layout/top-nav';

const crimsonPro = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EAC Forum',
  description: 'Discussions and gatherings across the Elkdonis network',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${crimsonPro.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased" suppressHydrationWarning>
        <TopNav />
        {children}
      </body>
    </html>
  );
}

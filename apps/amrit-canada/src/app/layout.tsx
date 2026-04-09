import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/tiptap/styles.css';
import './globals.css';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import type { Metadata } from 'next';
import { amritTheme } from '@/lib/theme';
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = {
  title: 'Amrit Vela Toronto',
  description: 'A 4:00 AM, 2.5 hour journey of Jap Ji, Yoga and Kirtan',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <MantineProvider theme={amritTheme}>
          <Notifications position="top-right" />
          <SiteHeader />
          <main>
            {children}
          </main>
          <footer
            style={{
              background: 'linear-gradient(135deg, var(--charcoal) 0%, #2C3E50 100%)',
              borderTop: '3px solid var(--saffron-bright)',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              color: 'var(--saffron-bright)',
              boxShadow: '0 -4px 15px rgba(0, 0, 0, 0.15)',
            }}
          >
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500, letterSpacing: '0.5px' }}>
              Crown yourself in the early hours of the morning 🙏
            </p>
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', opacity: 0.7, color: 'var(--cream)' }}>
              © {new Date().getFullYear()} Amrit Vela Toronto – Guru Dharam Singh. All rights reserved.
            </p>
          </footer>
        </MantineProvider>
      </body>
    </html>
  );
}

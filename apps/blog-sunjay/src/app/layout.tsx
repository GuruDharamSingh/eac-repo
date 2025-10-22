import '@mantine/core/styles.css';
import { MantineProvider, ColorSchemeScript } from '@mantine/core';

export const metadata = {
  title: "Sunjay's Blog",
  description: 'Personal blog and creative works',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider>
          <header className="border-b p-4">
            <h1 className="text-2xl font-bold">Sunjay's Blog</h1>
            <nav className="mt-2">
              <a href="/" className="mr-4">Home</a>
              <a href="/entry" className="mr-4">New Entry</a>
              <a href="/admin" className="mr-4">Admin</a>
            </nav>
          </header>
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
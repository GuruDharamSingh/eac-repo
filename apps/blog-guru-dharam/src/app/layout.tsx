import '@mantine/core/styles.css';
import { MantineProvider, ColorSchemeScript } from '@mantine/core';

export const metadata = {
  title: "Guru Dharam's Blog",
  description: 'Thoughts, writings, and creative explorations',
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
            <h1 className="text-2xl font-bold">Guru Dharam's Blog</h1>
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
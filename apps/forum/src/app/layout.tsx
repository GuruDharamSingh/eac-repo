export const metadata = {
  title: 'EAC Forum - Community Activity Feed',
  description: 'Aggregated content from all EAC organizations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto max-w-[880px] px-6 py-16 font-sans">{children}</main>
    </>
  );
}

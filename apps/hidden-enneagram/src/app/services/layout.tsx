import { SiteNav } from "@/components/site-nav";

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[880px] px-6 py-16 font-sans">{children}</main>
    </>
  );
}

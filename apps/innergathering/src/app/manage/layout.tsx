import Link from "next/link";
import type { Metadata } from "next";
import { requireOrgEditor } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Manage",
  // Editorial surfaces have no business in search results.
  robots: { index: false, follow: false },
};

const TABS = [
  { href: "/manage", label: "Content" },
  { href: "/manage/feeds", label: "Pages" },
  { href: "/manage/pages", label: "Site copy" },
  { href: "/manage/people", label: "People" },
  { href: "/manage/video", label: "Video" },
];

export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  // Gate here so every /manage route inherits it — a page that forgets the
  // check still can't render.
  const viewer = await requireOrgEditor();

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-serif text-3xl">Manage</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {viewer.email} · <span className="capitalize">{viewer.role}</span>
        </p>
      </header>

      <nav className="mt-6 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-t-md px-4 py-2 text-sm text-muted-foreground hover:bg-accent/40 hover:text-foreground"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8">{children}</div>
    </div>
  );
}

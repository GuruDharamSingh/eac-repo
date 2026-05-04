import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { ShellUserMenu } from "@/components/shell-user-menu";

export async function SiteShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link
            href={user ? "/hub" : "/"}
            className="font-serif text-lg tracking-wide text-foreground"
          >
            Elkdonis Arts Collective
          </Link>
          {user && (
            <ShellUserMenu email={user.email} />
          )}
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-6">{children}</div>
      </main>
      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Elkdonis Arts Collective
        </div>
      </footer>
    </div>
  );
}

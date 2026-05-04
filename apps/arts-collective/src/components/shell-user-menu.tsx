"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@elkdonis/auth-client";
import { cn } from "@/lib/utils";

export function ShellUserMenu({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const initial = email.charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card font-serif text-sm transition hover:border-primary/60",
          open && "border-primary/60"
        )}
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-md border border-border bg-card shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <nav className="py-1 text-sm" role="none">
            <MenuLink href="/hub">Onboarding Hub</MenuLink>
            <MenuLink href="/account">Account</MenuLink>
            <MenuLink href="/commitments">Commitments</MenuLink>
            <MenuLink href="/artists">Explore artists</MenuLink>
          </nav>
          <div className="border-t border-border p-2">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="w-full rounded-sm px-3 py-1.5 text-left text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      role="menuitem"
      className="block px-4 py-2 text-foreground/90 transition hover:bg-muted"
    >
      {children}
    </a>
  );
}

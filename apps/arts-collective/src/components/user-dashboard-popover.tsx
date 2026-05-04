"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "@elkdonis/auth-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  email: string;
  displayName: string | null;
  rootBase: string;
  isOwner: boolean;
  orgSlug: string;
};

export function UserDashboardPopover({
  email,
  displayName,
  rootBase,
  isOwner,
  orgSlug,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = displayName || email.split("@")[0];
  const initial = label.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    window.location.reload();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1 text-sm transition hover:border-primary/60",
          open && "border-primary/60"
        )}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary font-serif text-primary-foreground">
          {initial}
        </span>
        <span className="hidden pr-2 text-foreground sm:inline">{label}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-md border border-border bg-card shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-medium text-foreground">
              {label}
            </p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isOwner ? (
                <>
                  Owner of{" "}
                  <span className="text-foreground">{orgSlug}</span>
                </>
              ) : (
                <>
                  Member of{" "}
                  <span className="text-foreground">{orgSlug}</span>
                </>
              )}
            </p>
          </div>
          <nav className="py-1 text-sm" role="none">
            <MenuLink href={`${rootBase}/account`}>Account</MenuLink>
            <MenuLink href={`${rootBase}/commitments`}>Commitments</MenuLink>
            <MenuLink href={`${rootBase}/artists`}>
              Explore Elkdonis artists
            </MenuLink>
            {isOwner && (
              <MenuLink href={`${rootBase}/hub`}>
                Your onboarding hub
              </MenuLink>
            )}
          </nav>
          <div className="border-t border-border p-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleSignOut}
            >
              Sign out
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
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

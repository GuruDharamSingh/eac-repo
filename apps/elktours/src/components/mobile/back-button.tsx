"use client";

import { useRouter } from "next/navigation";

/** 44px round back button: browser history when there is some, else `href`. */
export function BackButton({ href = "/", label = "Back" }: { href?: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="m-back"
      aria-label={label}
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(href);
      }}
    >
      ←
    </button>
  );
}

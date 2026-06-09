"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { toggleFavoriteAction } from "@/app/actions";
import { cn } from "@/lib/utils";

/**
 * Heart toggle to favourite / save an artwork. Optimistic; falls back and
 * prompts sign-in when the visitor isn't logged in.
 */
export function FavoriteButton({
  artworkId,
  initialFavorited,
  variant = "icon",
  className,
}: {
  artworkId: string;
  initialFavorited: boolean;
  /** `icon` = round heart button; `full` = heart + label pill. */
  variant?: "icon" | "full";
  className?: string;
}) {
  const router = useRouter();
  const [favorited, setFavorited] = React.useState(initialFavorited);
  const [pending, setPending] = React.useState(false);

  async function toggle() {
    const next = !favorited;
    setFavorited(next); // optimistic
    setPending(true);
    try {
      const res = await toggleFavoriteAction({ artworkId, favorited: next });
      if (res.needsAuth) {
        setFavorited(!next);
        router.push(`/login?next=/artworks/${artworkId}`);
        return;
      }
      if (!res.ok) {
        setFavorited(!next);
        toast.error("Could not update your saved pieces.");
      }
    } catch {
      setFavorited(!next);
      toast.error("Could not update your saved pieces.");
    } finally {
      setPending(false);
    }
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={favorited}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors disabled:opacity-50",
          favorited
            ? "border-rose-300 bg-rose-50 text-rose-700"
            : "border-border hover:bg-muted",
          className
        )}
      >
        <Heart
          className={cn("h-4 w-4", favorited && "fill-rose-600 text-rose-600")}
        />
        {favorited ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from saved" : "Save this piece"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/80 backdrop-blur transition-colors hover:bg-muted disabled:opacity-50",
        className
      )}
    >
      <Heart
        className={cn(
          "h-4 w-4",
          favorited ? "fill-rose-600 text-rose-600" : "text-foreground"
        )}
      />
    </button>
  );
}

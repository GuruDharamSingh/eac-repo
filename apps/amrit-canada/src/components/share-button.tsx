"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@elkdonis/primitives";

/**
 * Gatherings spread by being pasted into a group chat, so the share link is a
 * first-class feature. Uses the native share sheet on mobile where it exists
 * and falls back to copying.
 */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  // Resolved after mount — `navigator` doesn't exist during SSR, and reading it
  // in render would mismatch hydration.
  const [hasNativeShare, setHasNativeShare] = useState(false);

  useEffect(() => {
    setHasNativeShare(typeof navigator !== "undefined" && Boolean(navigator.share));
  }, []);

  async function share() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User dismissed the sheet, or the browser refused — fall through to copy.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link — you can copy it from the address bar.");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={share}>
      {copied ? (
        <Check className="size-4" aria-hidden />
      ) : hasNativeShare ? (
        <Share2 className="size-4" aria-hidden />
      ) : (
        <Link2 className="size-4" aria-hidden />
      )}
      {copied ? "Copied" : "Share"}
    </Button>
  );
}

"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Share a card.
 *
 * On a phone this hands the rendered PNG straight to the OS share sheet, which
 * is the path that matters — this project lives or dies on people sending each
 * other pigeons. Desktop falls back to copying the link.
 */
export function ShareCardButton({ slug, title }: { slug: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/cards/${slug}`;

    // Try the native sheet with the card image attached.
    if (typeof navigator.share === "function") {
      try {
        const res = await fetch(`/api/cards/${slug}/card.png`);
        if (res.ok && typeof navigator.canShare === "function") {
          const blob = await res.blob();
          const file = new File([blob], `${slug}.png`, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title, text: title, url });
            return;
          }
        }
        await navigator.share({ title, text: title, url });
        return;
      } catch (err) {
        // The user dismissing the sheet is not a failure — say nothing.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  return (
    <Button onClick={share} className="gap-2">
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {copied ? "Copied" : "Share it"}
    </Button>
  );
}

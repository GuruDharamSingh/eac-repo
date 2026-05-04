"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SilexSurfaceControls({
  slug,
  layoutMode,
  hasPublished,
}: {
  slug: string;
  layoutMode: "default" | "silex";
  hasPublished: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openEditor(mode: "full" | "simple" = "full") {
    setBusy(mode === "simple" ? "simple-editor" : "editor");
    setError(null);
    try {
      const res = await fetch("/api/silex/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not open editor");
        return;
      }
      window.location.href = data.editorUrl;
    } catch {
      setError("Network error opening editor");
    } finally {
      setBusy(null);
    }
  }

  async function setLayout(mode: "default" | "silex") {
    setBusy(mode);
    setError(null);
    try {
      const res = await fetch("/api/silex/layout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not update site layout");
        return;
      }
      window.location.reload();
    } catch {
      setError("Network error updating site layout");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Button onClick={() => openEditor()} disabled={Boolean(busy)} size="sm">
          {busy === "editor" ? "Opening..." : "Open editor"}
        </Button>
        <Button
          onClick={() => openEditor("simple")}
          disabled={Boolean(busy)}
          size="sm"
          variant="secondary"
        >
          {busy === "simple-editor" ? "Opening..." : "Simple blocks"}
        </Button>
        {layoutMode === "silex" ? (
          <Button
            onClick={() => setLayout("default")}
            disabled={Boolean(busy)}
            size="sm"
            variant="outline"
          >
            {busy === "default" ? "Switching..." : "Use default site"}
          </Button>
        ) : (
          <Button
            onClick={() => setLayout("silex")}
            disabled={Boolean(busy)}
            size="sm"
            variant="outline"
          >
            {busy === "silex" ? "Activating..." : "Use Silex site"}
          </Button>
        )}
      </div>
      {!hasPublished && layoutMode !== "silex" && (
        <p className="max-w-[16rem] text-left text-xs text-muted-foreground sm:text-right">
          Publish from Silex before activating.
        </p>
      )}
      {error && <p className="max-w-[16rem] text-left text-xs text-destructive sm:text-right">{error}</p>}
    </div>
  );
}

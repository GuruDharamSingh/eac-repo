"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SilexLaunchButton({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/silex/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not open editor");
        return;
      }
      // Navigate in the same tab — the edit page will redirect to Silex with ?t=
      window.location.href = data.editorUrl;
    } catch (e) {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleOpen} disabled={loading} size="sm">
        {loading ? "Opening…" : "Open editor →"}
      </Button>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

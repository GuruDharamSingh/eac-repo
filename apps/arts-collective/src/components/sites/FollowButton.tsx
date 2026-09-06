"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function FollowButton({
  orgSlug,
  signedIn,
  following: initiallyFollowing,
  count: initialCount,
  loginUrl,
}: {
  orgSlug: string;
  signedIn: boolean;
  following: boolean;
  count: number;
  loginUrl: string;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/org/${orgSlug}/follow`, {
        method: following ? "DELETE" : "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFollowing(Boolean(data?.following));
        if (typeof data?.count === "number") setCount(data.count);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {signedIn ? (
        <Button variant={following ? "outline" : "default"} size="sm" disabled={busy} onClick={toggle}>
          {busy ? "…" : following ? "Following" : "Follow"}
        </Button>
      ) : (
        <Button asChild variant="default" size="sm">
          <a href={loginUrl}>Follow</a>
        </Button>
      )}
      <span className="text-xs text-muted-foreground">
        {count} {count === 1 ? "follower" : "followers"}
      </span>
    </div>
  );
}

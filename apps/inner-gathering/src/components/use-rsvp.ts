"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * RSVP state for a meeting card. The server decides whether an existing RSVP
 * still counts for the current cycle (recurring meetings reset after each
 * occurrence), so the client just reflects what GET returns.
 */
export function useRsvp(meetingId: string, enabled: boolean) {
  const [isAttending, setIsAttending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!enabled || checked) return;
    let cancelled = false;
    fetch(`/api/meetings/${meetingId}/rsvp`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setIsAttending(data.attending);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [meetingId, enabled, checked]);

  const rsvp = useCallback(
    async (shouldAttend: boolean, receiveEmailNotice = true) => {
      if (shouldAttend === isAttending) return;
      setIsLoading(true);
      try {
        if (!shouldAttend) {
          const res = await fetch(`/api/meetings/${meetingId}/rsvp`, { method: "DELETE" });
          if (res.ok) setIsAttending(false);
        } else {
          const res = await fetch(`/api/meetings/${meetingId}/rsvp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ receiveEmailNotice }),
          });
          if (res.ok) setIsAttending(true);
        }
      } catch {}
      finally {
        setIsLoading(false);
      }
    },
    [meetingId, isAttending]
  );

  return { isAttending, isLoading, rsvp };
}

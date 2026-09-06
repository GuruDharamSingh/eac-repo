"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================================================
// Thread-agnostic RSVP hook — one client-side implementation of "check my
// status, join, cancel" for any thread kind (meeting, event, workshop, and
// later auction listings/products), talking to the shared
// GET/POST/DELETE /api/threads/[id]/rsvp endpoint. Replaces three separate
// copies of this same fetch logic that had drifted apart (meeting-card,
// attendee-modal, and an unused use-rsvp hook).
// ============================================================================

export interface UseThreadRsvpOptions {
  /** Auto-check status via GET on mount. Default true. Set false when the
   *  caller already knows the answer server-side (e.g. a workshop page that
   *  also has to account for ownership/payment state the generic GET can't
   *  see) and just wants the join/cancel actions. */
  enabled?: boolean;
  /** Seeds the initial state — skips the loading flash when the caller
   *  already has the answer (server-rendered), and is required when
   *  `enabled` is false. */
  initialIsAttending?: boolean;
  /** Called after a successful join/cancel, e.g. to refetch an attendee list. */
  onChange?: (isAttending: boolean) => void;
}

export function useThreadRsvp(threadId: string, options: UseThreadRsvpOptions = {}) {
  const { enabled = true, initialIsAttending = false, onChange } = options;
  const [isAttending, setIsAttending] = useState(initialIsAttending);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!enabled || checked) return;
    let cancelled = false;
    fetch(`/api/threads/${threadId}/rsvp`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setIsAttending(Boolean(data.attending));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [threadId, enabled, checked]);

  const rsvp = useCallback(
    async (shouldAttend: boolean, receiveEmailNotice = true) => {
      if (shouldAttend === isAttending) return;
      setIsLoading(true);
      setError(null);
      try {
        if (!shouldAttend) {
          const res = await fetch(`/api/threads/${threadId}/rsvp`, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to cancel");
          }
          setIsAttending(false);
          onChange?.(false);
        } else {
          const res = await fetch(`/api/threads/${threadId}/rsvp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ receiveEmailNotice }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to RSVP");
          }
          setIsAttending(true);
          onChange?.(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    },
    [threadId, isAttending, onChange]
  );

  return { isAttending, isLoading, error, rsvp };
}

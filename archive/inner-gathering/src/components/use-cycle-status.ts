"use client";

import { useState, useCallback } from "react";
import { notifications } from "@mantine/notifications";
import type { Meeting } from "@elkdonis/types";

/**
 * Confirm/cancel state for a recurring meeting's current cycle. A guide
 * confirms to greenlight the occurrence or cancels to call it off; the server
 * records an event and handles notifications. Optimistically nudges the local
 * confirm/cancel counts so the card updates immediately.
 */
export function useCycleStatus(meeting: Meeting) {
  const [status, setStatus] = useState<"confirmed" | "cancelled" | null>(
    meeting.cycleStatus ?? null
  );
  const [confirmCount, setConfirmCount] = useState(meeting.cycleConfirmCount ?? 0);
  const [cancelCount, setCancelCount] = useState(meeting.cycleCancelCount ?? 0);
  const [busy, setBusy] = useState(false);

  const act = useCallback(
    async (action: "confirmed" | "cancelled") => {
      if (busy) return;
      setBusy(true);
      const prev = status;
      // Optimistic update
      setStatus(action);
      if (action === "confirmed" && prev !== "confirmed") setConfirmCount((c) => c + 1);
      if (action === "cancelled") setCancelCount((c) => c + 1);

      try {
        const res = await fetch(`/api/content/${meeting.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) throw new Error();
        notifications.show({
          color: action === "confirmed" ? "teal" : "red",
          message:
            action === "confirmed"
              ? "Confirmed for this cycle"
              : "Cancelled — RSVPs will be notified if no other guide is covering",
        });
      } catch {
        setStatus(prev);
        notifications.show({ color: "red", message: "Could not update — try again" });
      } finally {
        setBusy(false);
      }
    },
    [busy, status, meeting.id]
  );

  return {
    status,
    confirmCount,
    cancelCount,
    busy,
    confirm: () => act("confirmed"),
    cancel: () => act("cancelled"),
  };
}

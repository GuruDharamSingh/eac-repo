"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { foundationReviewAction } from "@/app/hub/studio/foundations/actions";

/**
 * After every foundations action, a toast saying what was done with an "Undo"
 * button: undo records a foundation-undo for that review
 * (src/foundations-rules.ts), so the item goes back to how it was.
 */
export function useFoundationUndo() {
  const router = useRouter();
  return (message: string, reviewId: string) =>
    toast(message, {
      duration: 6000,
      action: {
        label: "Undo",
        onClick: async () => {
          const r = await foundationReviewAction({ action: "foundation-undo", payload: { reviewId } });
          if (!r.ok) toast.error(r.error);
          else toast("Undone");
          router.refresh();
        },
      },
    });
}

"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { vocabReviewAction } from "@/app/hub/studio/vocabulary/actions";

/**
 * After every vocabulary action, a toast saying what was done with an "Undo"
 * button: undo records a vocab-undo for that review (src/vocab-rules.ts), so
 * the card, group, rating or added term goes back to how it was.
 */
export function useVocabUndo() {
  const router = useRouter();
  return (message: string, reviewId: string) =>
    toast(message, {
      duration: 8000,
      action: {
        label: "Undo",
        onClick: async () => {
          const r = await vocabReviewAction({ action: "vocab-undo", payload: { reviewId } });
          if (!r.ok) toast.error(r.error);
          else toast("Undone");
          router.refresh();
        },
      },
    });
}

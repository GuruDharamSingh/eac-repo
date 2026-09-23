"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setOwnProfileSectionAction } from "@/lib/account-actions";

/**
 * "Show my store on my page here." A presentation choice about the member's
 * own page, so it lives on /account next to the profile editor rather than in
 * the owner console.
 */
export function StoreSectionToggle({ initialOn }: { initialOn: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initialOn);
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input
        type="checkbox"
        className="mt-1"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          startTransition(async () => {
            const res = await setOwnProfileSectionAction({ key: "store", on: next });
            if (!res.ok) {
              // Put the switch back: a toggle left flipped after a failed save
              // tells the member something is on when it isn't.
              setOn(!next);
              toast.error(res.error ?? "Could not save that.");
              return;
            }
            toast.success(next ? "Your store now shows on your page." : "Store hidden from your page.");
            router.refresh();
          });
        }}
      />
      <span>
        <span className="font-medium">Show my store on my page here</span>
        <span className="block text-muted-foreground">
          Adds a section of your listed work to your profile on this site. Buying still
          happens on the marketplace.
        </span>
      </span>
    </label>
  );
}

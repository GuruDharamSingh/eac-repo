"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { openOrgStoreAction } from "../actions";

export function OpenOrgStoreButton({
  orgId,
  label,
  className,
}: {
  orgId: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      className={
        className ??
        "rounded-md border border-dashed border-border px-2.5 py-1 text-sm hover:bg-muted disabled:opacity-50"
      }
      onClick={async () => {
        setPending(true);
        try {
          const res = await openOrgStoreAction(orgId);
          if (!res.ok) return toast.error(res.error ?? "Could not open the store.");
          toast.success("Store opened.");
          router.push("/studio");
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? "Opening…" : label}
    </button>
  );
}

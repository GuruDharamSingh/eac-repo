"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmServiceOrderAction } from "@/lib/cms/actions";

export function ConfirmOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const res = await confirmServiceOrderAction(orderId);
      if (res.ok) {
        toast.success("Marked paid.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not confirm this order.");
      }
    });
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={confirm}>
      {pending ? "Confirming…" : "Mark eTransfer received"}
    </Button>
  );
}

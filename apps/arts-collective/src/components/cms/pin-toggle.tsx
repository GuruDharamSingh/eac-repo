"use client";

import * as React from "react";
import { Pin, PinOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { togglePinAction } from "@/lib/cms/actions";

type Props = {
  threadId: string;
  pinned: boolean;
  className?: string;
};

export function PinToggle({ threadId, pinned, className }: Props) {
  const [isPending, startTransition] = React.useTransition();
  const [optimistic, setOptimistic] = React.useState(pinned);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const next = !optimistic;
      setOptimistic(next);
      const result = await togglePinAction(threadId);
      if (result.ok === false) {
        setOptimistic(!next);
        toast.error(result.error);
        return;
      }
      setOptimistic(result.pinned);
      toast.success(result.pinned ? "Pinned to top" : "Unpinned");
    });
  }

  const Icon = optimistic ? PinOff : Pin;
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={onClick}
      disabled={isPending}
      aria-pressed={optimistic}
      aria-label={optimistic ? "Unpin" : "Pin to top"}
      title={optimistic ? "Unpin" : "Pin to top"}
      className={cn(
        "h-7 w-7",
        optimistic && "text-primary",
        className
      )}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

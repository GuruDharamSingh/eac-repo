"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const REASONS = [
  ["not_a_pigeon", "Not a pigeon"],
  ["identifiable_person", "Shows an identifiable person"],
  ["copyright", "Not the uploader's photo"],
  ["duplicate", "Duplicate of another card"],
  ["wrong_place", "Wrong location"],
  ["offensive", "Offensive"],
  ["other", "Something else"],
] as const;

export function ReportButton({ threadId }: { threadId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("not_a_pigeon");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, reason, detail: detail || null }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error ?? "Couldn't file that report.");
        return;
      }
      toast.success(
        data.alreadyReported
          ? "You've already reported this one — it's in the queue."
          : "Thanks. Someone will take a look."
      );
      setOpen(false);
      setDetail("");
    } catch {
      toast.error("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"
        >
          <Flag className="size-3.5" />
          Report
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this card</DialogTitle>
          <DialogDescription>
            Reporting doesn&apos;t hide the card — it flags it for a human to look at.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={reason} onValueChange={setReason} className="gap-2">
          {REASONS.map(([value, label]) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem value={value} id={`r-${value}`} />
              <Label htmlFor={`r-${value}`} className="font-normal">
                {label}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <div className="space-y-1.5">
          <Label htmlFor="report-detail" className="text-xs text-muted-foreground">
            Anything else? (optional)
          </Label>
          <Textarea
            id="report-detail"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={600}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Sending…" : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

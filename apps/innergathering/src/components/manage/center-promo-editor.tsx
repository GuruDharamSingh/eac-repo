"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { saveCenterPromoAction, type CenterPromoInput } from "@/lib/cms/actions";

/**
 * The /center promotion slot: a title, a line of body, an optional link and
 * image. Same shape as SectionEditor — local state, a transition, a toast —
 * with a Clear that removes the placement so the slot disappears.
 */
export function CenterPromoEditor({
  initial,
  placed,
}: {
  initial: CenterPromoInput | null;
  /** Something is placed (of any kind), so Clear is offered. */
  placed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<CenterPromoInput>(
    () => initial ?? { title: "", body: "", href: "", imageUrl: "" }
  );
  const set = (k: keyof CenterPromoInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setState((s) => ({ ...s, [k]: e.target.value }));

  function save() {
    startTransition(async () => {
      const res = await saveCenterPromoAction(state);
      if (res.ok) {
        toast.success("Placed.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not save.");
      }
    });
  }

  function clear() {
    startTransition(async () => {
      const res = await saveCenterPromoAction(null);
      if (res.ok) {
        toast.success("Cleared.");
        setState({ title: "", body: "", href: "", imageUrl: "" });
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not clear.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <h3 className="font-serif text-lg">Promoted</h3>
          <p className="text-sm text-muted-foreground">
            The card under a member&rsquo;s profile on /center. Nothing is shown until something is
            placed here; Clear takes it down.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="promo-title">Title</Label>
          <Input id="promo-title" value={state.title} onChange={set("title")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="promo-body">Body</Label>
          <Textarea id="promo-body" rows={3} value={state.body} onChange={set("body")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="promo-href">Link (optional)</Label>
          <Input id="promo-href" placeholder="https://… or /page" value={state.href} onChange={set("href")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="promo-image">Image URL (optional)</Label>
          <Input id="promo-image" placeholder="/api/media/… or https://…" value={state.imageUrl} onChange={set("imageUrl")} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={pending || !state.title.trim()}>
            {pending ? "Saving…" : initial ? "Update" : "Place"}
          </Button>
          {placed && (
            <Button type="button" variant="outline" onClick={clear} disabled={pending}>
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

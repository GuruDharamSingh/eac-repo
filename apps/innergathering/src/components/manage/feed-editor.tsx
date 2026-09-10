"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { OrgFeed } from "@elkdonis/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { saveFeedAction } from "@/lib/cms/actions";

/** Existing feed → edit form; no feed → the "add a page" form. */
export function FeedEditor({ feed }: { feed?: OrgFeed }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isNew = !feed;

  const [slug, setSlug] = useState(feed?.slug ?? "");
  const [name, setName] = useState(feed?.name ?? "");
  const [tagline, setTagline] = useState(feed?.tagline ?? "");
  const [description, setDescription] = useState(feed?.description ?? "");
  const [presenter, setPresenter] = useState(feed?.presenter ?? "");
  const [accent, setAccent] = useState(feed?.accent ?? "#E6B422");
  const [sortOrder, setSortOrder] = useState(String(feed?.sortOrder ?? 0));
  const [isPublic, setIsPublic] = useState(feed?.isPublic ?? true);

  function save() {
    startTransition(async () => {
      const res = await saveFeedAction(slug, {
        name,
        tagline,
        description,
        presenter,
        accent,
        sortOrder: Number(sortOrder) || 0,
        isPublic,
      });

      if (!res.ok) {
        toast.error(res.error ?? "Could not save.");
        return;
      }

      toast.success(isNew ? "Page added." : "Saved.");
      if (isNew) {
        setSlug("");
        setName("");
        setTagline("");
        setDescription("");
        setPresenter("");
      }
      router.refresh();
    });
  }

  return (
    <Card className={isNew ? "border-dashed" : undefined}>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          {!isNew && accent && (
            <span
              aria-hidden
              className="size-4 shrink-0 rounded-full border border-border"
              style={{ backgroundColor: accent }}
            />
          )}
          <h3 className="font-serif text-lg">{isNew ? "Add a page" : feed.name}</h3>
          {!isNew && (
            <code className="text-xs text-muted-foreground">/{feed.slug}</code>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`slug-${slug || "new"}`}>URL slug</Label>
            <Input
              id={`slug-${slug || "new"}`}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={!isNew}
              placeholder="kirtan"
            />
            {!isNew && (
              <p className="text-xs text-muted-foreground">
                Fixed — changing it would break shared links.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`name-${slug || "new"}`}>Name</Label>
            <Input
              id={`name-${slug || "new"}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kirtan"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`tagline-${slug || "new"}`}>Tagline</Label>
          <Input
            id={`tagline-${slug || "new"}`}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="One line under the page title"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`description-${slug || "new"}`}>Description</Label>
          <Textarea
            id={`description-${slug || "new"}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor={`presenter-${slug || "new"}`}>Presented by</Label>
            <Input
              id={`presenter-${slug || "new"}`}
              value={presenter}
              onChange={(e) => setPresenter(e.target.value)}
              placeholder="Guru Dharam Singh"
            />
            <p className="text-xs text-muted-foreground">
              Shown as &ldquo;Presented by&rdquo; on the page. Only name a person or group
              who has actually agreed to it — this reads as an endorsement.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`accent-${slug || "new"}`}>Accent colour</Label>
            <Input
              id={`accent-${slug || "new"}`}
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-9 w-20 p-1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`order-${slug || "new"}`}>Order</Label>
            <Input
              id={`order-${slug || "new"}`}
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id={`public-${slug || "new"}`}
            checked={isPublic}
            onCheckedChange={setIsPublic}
          />
          <Label htmlFor={`public-${slug || "new"}`} className="font-normal">
            Show in the site navigation
          </Label>
        </div>

        <Button onClick={save} disabled={pending} size="sm">
          {pending ? "Saving…" : isNew ? "Add page" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}

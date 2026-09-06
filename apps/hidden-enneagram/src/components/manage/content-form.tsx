"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { MediaField } from "@/components/manage/media-field";
import { saveContentAction } from "@/lib/cms/actions";
import type { ContentFormValues } from "@/lib/cms/schema";
import type { ContentFormDefaults } from "@/lib/cms/form-defaults";

export interface FeedOption {
  slug: string;
  name: string;
  minRole: string | null;
}

/**
 * The create/edit form for everything on this site.
 *
 * Structured like amrit-canada's ContentForm — a kind switch at the top, a
 * required feed selector, then kind-specific cards — so the two sites are
 * learned once. The kinds here are post and service; the service tier adds
 * pricing and booking state on top of the shared fields.
 */
export function ContentForm({
  feeds,
  defaults,
  threadId,
}: {
  feeds: FeedOption[];
  defaults: ContentFormDefaults;
  threadId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(defaults);

  function set<K extends keyof ContentFormDefaults>(key: K, value: ContentFormDefaults[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(status: "draft" | "published") {
    const shared = {
      feedSlug: form.feedSlug,
      title: form.title,
      excerpt: form.excerpt,
      body: form.body,
      coverImageUrl: form.coverImageUrl,
      status,
      visibility: form.visibility,
    };

    const input: ContentFormValues =
      form.kind === "service"
        ? {
            kind: "service",
            ...shared,
            subtitle: form.subtitle,
            bookingType: form.bookingType,
            format: form.format || undefined,
            price: form.price,
            currency: form.currency,
            slidingScale: form.slidingScale,
            priceSlidingMin: form.slidingScale ? form.priceSlidingMin : "",
            slidingScaleNote: form.slidingScaleNote,
            sessionCount: form.sessionCount,
            sessionDurationHrs: form.sessionDurationHrs,
            recurrenceLabel: form.recurrenceLabel,
            location: form.location,
            bannerImageUrl: form.bannerImageUrl,
            registrationStatus: form.registrationStatus,
          }
        : { kind: "post", ...shared };

    startTransition(async () => {
      const res = await saveContentAction(input, threadId);
      if (!res.ok) {
        toast.error(res.error ?? "Could not save.");
        return;
      }
      toast.success(status === "published" ? "Published." : "Saved as a draft.");
      router.push("/manage");
      router.refresh();
    });
  }

  const isService = form.kind === "service";
  const selectedFeed = feeds.find((f) => f.slug === form.feedSlug);

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit("published");
      }}
    >
      <Tabs
        value={form.kind}
        onValueChange={(v) => set("kind", v as ContentFormDefaults["kind"])}
      >
        <TabsList>
          <TabsTrigger value="post">Writing</TabsTrigger>
          <TabsTrigger value="service">Service</TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="-mt-4 text-sm text-muted-foreground">
        {isService
          ? "Something people can book and pay for — a reading, a workshop, a series."
          : "An essay, a note or an announcement. No price, no booking."}
      </p>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="space-y-1.5">
            <Label htmlFor="feed">Which page does this go on?</Label>
            <Select value={form.feedSlug} onValueChange={(v) => set("feedSlug", v)}>
              <SelectTrigger id="feed">
                <SelectValue placeholder="Choose a page" />
              </SelectTrigger>
              <SelectContent>
                {feeds.map((feed) => (
                  <SelectItem key={feed.slug} value={feed.slug}>
                    {feed.name}
                    {feed.minRole ? " (members only)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedFeed?.minRole && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3" aria-hidden />
                This whole page is members-only — signed-out visitors can&rsquo;t reach it.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              required
            />
          </div>

          {isService && (
            <div className="space-y-1.5">
              <Label htmlFor="subtitle">Subtitle</Label>
              <Input
                id="subtitle"
                value={form.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
                placeholder="A one-hour session to map your core type"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="excerpt">Short summary</Label>
            <Textarea
              id="excerpt"
              value={form.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
              rows={2}
              maxLength={280}
              placeholder="Shown on cards and in link previews. Left blank, the opening of the body is used."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Body</Label>
            <RichTextEditor
              value={form.body}
              onChange={(html) => set("body", html)}
              placeholder={
                isService
                  ? "What happens in the session, who it's for, what to expect."
                  : "Write here…"
              }
              minHeight={260}
            />
          </div>

          <MediaField
            label="Cover image"
            value={form.coverImageUrl}
            onChange={(url) => set("coverImageUrl", url)}
            hint="Shown on cards, at the top of the page, and in link previews."
          />
        </CardContent>
      </Card>

      {isService && (
        <>
          <Card>
            <CardContent className="space-y-5 p-6">
              <h3 className="font-serif text-lg">Type and format</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="bookingType">Booking type</Label>
                  <Select
                    value={form.bookingType}
                    onValueChange={(v) =>
                      set("bookingType", v as ContentFormDefaults["bookingType"])
                    }
                  >
                    <SelectTrigger id="bookingType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one_on_one">One-on-one</SelectItem>
                      <SelectItem value="group">Group / workshop</SelectItem>
                      <SelectItem value="async">Self-paced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="format">Where</Label>
                  <Select
                    value={form.format || undefined}
                    onValueChange={(v) => set("format", v as ContentFormDefaults["format"])}
                  >
                    <SelectTrigger id="format">
                      <SelectValue placeholder="Choose one" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_person">In person</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sessionCount">Sessions</Label>
                  <Input
                    id="sessionCount"
                    type="number"
                    min={1}
                    value={form.sessionCount}
                    onChange={(e) => set("sessionCount", e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sessionDurationHrs">Length (hours)</Label>
                  <Input
                    id="sessionDurationHrs"
                    type="number"
                    step="0.25"
                    min={0.25}
                    value={form.sessionDurationHrs}
                    onChange={(e) => set("sessionDurationHrs", e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="recurrenceLabel">Schedule</Label>
                  <Input
                    id="recurrenceLabel"
                    value={form.recurrenceLabel}
                    onChange={(e) => set("recurrenceLabel", e.target.value)}
                    placeholder="By appointment"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Video call, or a street address"
                />
              </div>

              <MediaField
                label="Banner image"
                value={form.bannerImageUrl}
                onChange={(url) => set("bannerImageUrl", url)}
                hint="Wide image behind the title. Falls back to the cover image."
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-5 p-6">
              <h3 className="font-serif text-lg">Pricing</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="price">Price</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min={0.01}
                    value={form.price}
                    onChange={(e) => set("price", e.target.value)}
                    placeholder="120.00"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={form.currency}
                    onChange={(e) => set("currency", e.target.value.toUpperCase())}
                    maxLength={3}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="slidingScale"
                  checked={form.slidingScale}
                  onCheckedChange={(v) => set("slidingScale", v)}
                />
                <Label htmlFor="slidingScale" className="font-normal">
                  Offer a sliding scale
                </Label>
              </div>

              {form.slidingScale && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="priceSlidingMin">Floor price</Label>
                    <Input
                      id="priceSlidingMin"
                      type="number"
                      step="0.01"
                      min={0}
                      value={form.priceSlidingMin}
                      onChange={(e) => set("priceSlidingMin", e.target.value)}
                      placeholder="60.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="slidingScaleNote">Note shown to buyers</Label>
                    <Input
                      id="slidingScaleNote"
                      value={form.slidingScaleNote}
                      onChange={(e) => set("slidingScaleNote", e.target.value)}
                      placeholder="Reach out if cost is a barrier."
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="registrationStatus">Booking status</Label>
                <Select
                  value={form.registrationStatus}
                  onValueChange={(v) =>
                    set("registrationStatus", v as ContentFormDefaults["registrationStatus"])
                  }
                >
                  <SelectTrigger id="registrationStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open — Book now</SelectItem>
                    <SelectItem value="waitlist">Waitlist</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="space-y-1.5">
            <Label htmlFor="visibility">Who can see it</Label>
            <Select
              value={form.visibility}
              onValueChange={(v) => set("visibility", v as ContentFormDefaults["visibility"])}
            >
              <SelectTrigger id="visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC">Anyone</SelectItem>
                <SelectItem value="ORGANIZATION">Members only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Members-only items are invisible to signed-out visitors, even by direct link.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Publish"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => submit("draft")}>
          Save as draft
        </Button>
      </div>
    </form>
  );
}

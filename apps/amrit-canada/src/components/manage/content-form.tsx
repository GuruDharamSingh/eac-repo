"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { MediaField } from "@/components/manage/media-field";
import { MaterialsField } from "@/components/manage/materials-field";
import { saveContentAction } from "@/lib/cms/actions";
import type { ContentFormValues } from "@/lib/cms/schema";
import type { ContentFormDefaults } from "@/lib/cms/form-defaults";

export interface FeedOption {
  slug: string;
  name: string;
  presenter: string | null;
}

/**
 * The create/edit form for everything on the site.
 *
 * Adapted from arts-collective's create-content-dialog, with the addition that
 * makes it work here: a required FEED selector. "Which of my three pages does
 * this go on" is the question that distinguishes this site's content model,
 * and it's the field the arts-collective version doesn't have.
 *
 * Two kinds for now — a post (writing, no date) and a meeting (a gathering
 * with a time, RSVPs and possibly a recurrence). Workshops are a later pass.
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
      materialIds: form.materials.map((m) => m.id),
      createDocument: form.createDocument,
      createTalkRoom: form.createTalkRoom,
      status,
      visibility: form.visibility,
    };

    const input: ContentFormValues =
      form.kind === "meeting"
        ? {
            kind: "meeting",
            ...shared,
            scheduledAt: form.scheduledAt,
            durationMinutes: form.durationMinutes,
            location: form.location,
            isOnline: form.isOnline,
            meetingUrl: form.meetingUrl,
            videoLink: form.videoLink,
            recurrencePattern: form.recurrencePattern,
            recurrenceUntil: form.recurrenceUntil,
            isRsvpEnabled: form.isRsvpEnabled,
            rsvpDeadline: form.rsvpDeadline,
            attendeeLimit: form.attendeeLimit,
            minAttendees: form.minAttendees,
            notifyOnMinAttendees: form.notifyOnMinAttendees,
          }
        : { kind: "post", ...shared };

    startTransition(async () => {
      const res = await saveContentAction(input, threadId);
      if (!res.ok) {
        toast.error(res.error ?? "Could not save.");
        return;
      }
      toast.success(status === "published" ? "Published." : "Saved as a draft.");
      for (const warning of res.warnings ?? []) toast.warning(warning);
      router.push("/manage");
      router.refresh();
    });
  }

  const selectedFeed = feeds.find((f) => f.slug === form.feedSlug);
  const isMeeting = form.kind === "meeting";

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit("published");
      }}
    >
      <Tabs value={form.kind} onValueChange={(v) => set("kind", v as "post" | "meeting")}>
        <TabsList>
          <TabsTrigger value="post">Post</TabsTrigger>
          <TabsTrigger value="meeting">Gathering</TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="-mt-4 text-sm text-muted-foreground">
        {isMeeting
          ? "Something with a date and time that people can RSVP to."
          : "Writing, news or an announcement — no date attached."}
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
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedFeed?.presenter && (
              <p className="text-xs text-muted-foreground">
                Presented by {selectedFeed.presenter}
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
            <RichTextEditor value={form.body} onChange={(html) => set("body", html)} />
          </div>

          <MediaField
            label="Cover image"
            value={form.coverImageUrl}
            onChange={(url) => set("coverImageUrl", url)}
            hint="Shown on cards, at the top of the page, and in link previews."
          />
        </CardContent>
      </Card>

      {isMeeting && (
        <Card>
          <CardContent className="space-y-5 p-6">
            <h3 className="font-serif text-lg">When and where</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="scheduledAt">Starts</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => set("scheduledAt", e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">Toronto time.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="duration">Length (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={5}
                  value={form.durationMinutes}
                  onChange={(e) => set("durationMinutes", e.target.value)}
                  placeholder="150"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="348 Palmerston Blvd, third floor"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="isOnline"
                checked={form.isOnline}
                onCheckedChange={(v) => set("isOnline", v)}
              />
              <Label htmlFor="isOnline" className="font-normal">
                People can join online too
              </Label>
            </div>

            {form.isOnline && (
              <div className="space-y-1.5">
                <Label htmlFor="meetingUrl">Join link</Label>
                <Input
                  id="meetingUrl"
                  type="url"
                  value={form.meetingUrl}
                  onChange={(e) => set("meetingUrl", e.target.value)}
                  placeholder="https://…"
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="recurrence">Repeats</Label>
                <Select
                  value={form.recurrencePattern}
                  onValueChange={(v) =>
                    set("recurrencePattern", v as ContentFormDefaults["recurrencePattern"])
                  }
                >
                  <SelectTrigger id="recurrence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Just once</SelectItem>
                    <SelectItem value="DAILY">Every day</SelectItem>
                    <SelectItem value="WEEKLY">Every week</SelectItem>
                    <SelectItem value="MONTHLY">Every month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.recurrencePattern !== "NONE" && (
                <div className="space-y-1.5">
                  <Label htmlFor="recurrenceUntil">Until (optional)</Label>
                  <Input
                    id="recurrenceUntil"
                    type="date"
                    value={form.recurrenceUntil}
                    onChange={(e) => set("recurrenceUntil", e.target.value)}
                  />
                </div>
              )}
            </div>

            {form.recurrencePattern !== "NONE" && (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Recurring gatherings need confirming each cycle. RSVPs reset each time, and the
                page shows &ldquo;not yet confirmed&rdquo; until you confirm it from the content
                list.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {isMeeting && (
        <Card>
          <CardContent className="space-y-5 p-6">
            <h3 className="font-serif text-lg">RSVPs</h3>

            <div className="flex items-center gap-3">
              <Switch
                id="rsvp"
                checked={form.isRsvpEnabled}
                onCheckedChange={(v) => set("isRsvpEnabled", v)}
              />
              <Label htmlFor="rsvp" className="font-normal">
                Let people say they&rsquo;re coming
              </Label>
            </div>

            {form.isRsvpEnabled && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="attendeeLimit">Maximum people</Label>
                    <Input
                      id="attendeeLimit"
                      type="number"
                      min={1}
                      value={form.attendeeLimit}
                      onChange={(e) => set("attendeeLimit", e.target.value)}
                      placeholder="No limit"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rsvpDeadline">RSVP closes</Label>
                    <Input
                      id="rsvpDeadline"
                      type="datetime-local"
                      value={form.rsvpDeadline}
                      onChange={(e) => set("rsvpDeadline", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="minAttendees">Minimum to go ahead</Label>
                    <Input
                      id="minAttendees"
                      type="number"
                      min={1}
                      value={form.minAttendees}
                      onChange={(e) => set("minAttendees", e.target.value)}
                      placeholder="No minimum"
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="notifyMin"
                        checked={form.notifyOnMinAttendees}
                        onCheckedChange={(v) => set("notifyOnMinAttendees", v)}
                      />
                      <Label htmlFor="notifyMin" className="font-normal">
                        Email me when it&rsquo;s reached
                      </Label>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h3 className="font-serif text-lg">Materials</h3>
            <p className="text-sm text-muted-foreground">
              Anything people should have in hand — Jap Ji, a song sheet, an order of
              service. Shown as downloads on the page.
            </p>
          </div>
          <MaterialsField
            value={form.materials}
            onChange={(items) => set("materials", items)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-6">
          <h3 className="font-serif text-lg">Working space</h3>
          <p className="-mt-3 text-sm text-muted-foreground">
            Optional extras kept in the collective&rsquo;s Nextcloud.
          </p>

          {form.documentUrl ? (
            <p className="text-sm">
              Living document:{" "}
              <a
                href={form.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                open it
              </a>
            </p>
          ) : (
            <div className="flex items-start gap-3">
              <Switch
                id="createDocument"
                checked={form.createDocument}
                onCheckedChange={(v) => set("createDocument", v)}
              />
              <div>
                <Label htmlFor="createDocument" className="font-normal">
                  Create a living document
                </Label>
                <p className="text-xs text-muted-foreground">
                  A shared page anyone with the link can edit together — notes, a running
                  order, a reading list.
                </p>
              </div>
            </div>
          )}

          {form.talkToken ? (
            <p className="text-sm">
              Talk room created — the join link appears on the page.
            </p>
          ) : (
            <div className="flex items-start gap-3">
              <Switch
                id="createTalkRoom"
                checked={form.createTalkRoom}
                onCheckedChange={(v) => set("createTalkRoom", v)}
              />
              <div>
                <Label htmlFor="createTalkRoom" className="font-normal">
                  Create a Talk room
                </Label>
                <p className="text-xs text-muted-foreground">
                  A video/chat room people can join from the page, no account needed.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
                <SelectItem value="INVITE_ONLY">Invite only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only public items appear on the site&rsquo;s pages.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Publish"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => submit("draft")}
        >
          Save as draft
        </Button>
      </div>
    </form>
  );
}

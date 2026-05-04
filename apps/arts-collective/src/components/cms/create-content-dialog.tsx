"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { nanoid } from "nanoid";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { cn } from "@/lib/utils";
import { createThreadAction } from "@/lib/cms/actions";
import type {
  PostFormInput,
  WorkshopFormInput,
  EventFormInput,
  SessionInput,
} from "@/lib/cms/schema";

type Kind = "post" | "workshop" | "event";

type Props = {
  orgSlug: string;
  triggerLabel?: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
  defaultKind?: Kind;
};

export function CreateContentDialog({
  orgSlug,
  triggerLabel = "Create content",
  triggerVariant = "default",
  triggerSize = "sm",
  defaultKind = "post",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<Kind>(defaultKind);

  // Shared base fields.
  const [title, setTitle] = React.useState("");
  const [excerpt, setExcerpt] = React.useState("");
  const [body, setBody] = React.useState("");
  const [visibility, setVisibility] = React.useState<
    "PUBLIC" | "ORGANIZATION" | "INVITE_ONLY"
  >("PUBLIC");
  const [shareToNetwork, setShareToNetwork] = React.useState(false);
  const [docUrl, setDocUrl] = React.useState("");

  // Schedule fields (workshop/event).
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState<string>("60");
  const [location, setLocation] = React.useState("");
  const [format, setFormat] = React.useState<"in_person" | "online" | "hybrid">("online");
  const [meetingUrl, setMeetingUrl] = React.useState("");
  const [isRsvpEnabled, setIsRsvpEnabled] = React.useState(true);
  const [attendeeLimit, setAttendeeLimit] = React.useState<string>("");
  const [createTalkRoom, setCreateTalkRoom] = React.useState(false);

  // Workshop-only.
  const [price, setPrice] = React.useState<string>("");
  const [currency, setCurrency] = React.useState("USD");
  const [sessions, setSessions] = React.useState<SessionInput[]>([]);

  const [submitting, setSubmitting] = React.useState(false);

  function reset() {
    setTitle("");
    setExcerpt("");
    setBody("");
    setVisibility("PUBLIC");
    setShareToNetwork(false);
    setDocUrl("");
    setScheduledAt("");
    setDurationMinutes("60");
    setLocation("");
    setFormat("online");
    setMeetingUrl("");
    setIsRsvpEnabled(true);
    setAttendeeLimit("");
    setCreateTalkRoom(false);
    setPrice("");
    setCurrency("USD");
    setSessions([]);
    setKind(defaultKind);
  }

  async function submit(status: "draft" | "published") {
    if (submitting) return;
    setSubmitting(true);
    try {
      let payload: PostFormInput | WorkshopFormInput | EventFormInput;
      const base = {
        orgSlug,
        title,
        excerpt,
        body,
        status,
        visibility,
        share_to_network: shareToNetwork,
        create_talk_room: false,
        nextcloud_doc_url: docUrl,
      };

      if (kind === "post") {
        payload = { kind: "post", ...base, create_talk_room: createTalkRoom };
      } else if (kind === "workshop") {
        payload = {
          kind: "workshop",
          ...base,
          create_talk_room: createTalkRoom,
          scheduled_at: scheduledAt,
          duration_minutes: durationMinutes ? Number(durationMinutes) : undefined,
          location,
          format,
          meeting_url: meetingUrl,
          is_rsvp_enabled: isRsvpEnabled,
          attendee_limit: attendeeLimit ? Number(attendeeLimit) : undefined,
          price: price ? Number(price) : undefined,
          currency,
          sessions,
        };
      } else {
        payload = {
          kind: "event",
          ...base,
          create_talk_room: createTalkRoom,
          scheduled_at: scheduledAt,
          duration_minutes: durationMinutes ? Number(durationMinutes) : undefined,
          location,
          format,
          meeting_url: meetingUrl,
          is_rsvp_enabled: isRsvpEnabled,
          attendee_limit: attendeeLimit ? Number(attendeeLimit) : undefined,
        };
      }

      const result = await createThreadAction(payload);
      if (result.ok === false) {
        toast.error(result.error);
        return;
      }
      toast.success(
        status === "published" ? "Published" : "Saved as draft"
      );
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size={triggerSize} variant={triggerVariant}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create content</DialogTitle>
          <DialogDescription>
            Publish a post, schedule a workshop, or announce an event.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <TabsList className="w-full">
            <TabsTrigger value="post" className="flex-1">Post</TabsTrigger>
            <TabsTrigger value="workshop" className="flex-1">Workshop</TabsTrigger>
            <TabsTrigger value="event" className="flex-1">Event</TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            {/* Shared core fields */}
            <Field label="Title" required>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What are you announcing?"
                autoFocus
              />
            </Field>

            <Field
              label="Excerpt"
              hint="A short blurb shown in feeds and cards. Optional."
            >
              <Textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="One or two sentences."
                rows={2}
                maxLength={280}
              />
            </Field>

            <Field label="Body">
              <RichTextEditor
                value={body}
                onChange={setBody}
                placeholder={
                  kind === "post"
                    ? "Write your post…"
                    : kind === "workshop"
                    ? "Describe the workshop, prerequisites, what to bring…"
                    : "Describe the event, agenda, who's invited…"
                }
                minHeight={180}
              />
            </Field>

            <TabsContent value="post" className="mt-0 space-y-4">
              <TalkRoomToggle
                createTalkRoom={createTalkRoom}
                onCreateTalkRoom={setCreateTalkRoom}
              />
            </TabsContent>

            <TabsContent value="workshop" className="mt-0 space-y-4">
              <ScheduleFields
                scheduledAt={scheduledAt}
                onScheduledAt={setScheduledAt}
                durationMinutes={durationMinutes}
                onDurationMinutes={setDurationMinutes}
                format={format}
                onFormat={setFormat}
                location={location}
                onLocation={setLocation}
                meetingUrl={meetingUrl}
                onMeetingUrl={setMeetingUrl}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Price" hint="Leave blank for free.">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="1"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0"
                    />
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="CAD">CAD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </Field>
                <Field label="Attendee limit" hint="Optional cap.">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={attendeeLimit}
                    onChange={(e) => setAttendeeLimit(e.target.value)}
                    placeholder="e.g. 12"
                  />
                </Field>
              </div>

              <SessionsEditor sessions={sessions} onChange={setSessions} />

              <RsvpAndTalkRow
                isRsvpEnabled={isRsvpEnabled}
                onIsRsvpEnabled={setIsRsvpEnabled}
                createTalkRoom={createTalkRoom}
                onCreateTalkRoom={setCreateTalkRoom}
              />
            </TabsContent>

            <TabsContent value="event" className="mt-0 space-y-4">
              <ScheduleFields
                scheduledAt={scheduledAt}
                onScheduledAt={setScheduledAt}
                durationMinutes={durationMinutes}
                onDurationMinutes={setDurationMinutes}
                format={format}
                onFormat={setFormat}
                location={location}
                onLocation={setLocation}
                meetingUrl={meetingUrl}
                onMeetingUrl={setMeetingUrl}
              />
              <Field label="Attendee limit" hint="Optional cap.">
                <Input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={attendeeLimit}
                  onChange={(e) => setAttendeeLimit(e.target.value)}
                  placeholder="e.g. 50"
                />
              </Field>
              <RsvpAndTalkRow
                isRsvpEnabled={isRsvpEnabled}
                onIsRsvpEnabled={setIsRsvpEnabled}
                createTalkRoom={createTalkRoom}
                onCreateTalkRoom={setCreateTalkRoom}
              />
            </TabsContent>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Visibility">
                <Select
                  value={visibility}
                  onValueChange={(v) =>
                    setVisibility(v as typeof visibility)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">
                      Public — anyone can see
                    </SelectItem>
                    <SelectItem value="ORGANIZATION">
                      Organization only
                    </SelectItem>
                    <SelectItem value="INVITE_ONLY">Invite only</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Linked document"
                hint="Optional Nextcloud document URL."
              >
                <Input
                  type="url"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="https://…"
                />
              </Field>
            </div>

            <label className="flex items-start gap-3 rounded-md border border-input bg-muted/20 p-3 text-sm">
              <Switch
                checked={shareToNetwork}
                onCheckedChange={setShareToNetwork}
              />
              <span>
                <span className="font-medium">Share to network</span>
                <span className="block text-xs text-muted-foreground">
                  Surface this in the cross-org Community feed.
                </span>
              </span>
            </label>
          </div>
        </Tabs>

        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button variant="ghost" type="button" disabled={submitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="outline"
            type="button"
            onClick={() => submit("draft")}
            disabled={submitting || title.trim().length < 2}
          >
            Save draft
          </Button>
          <Button
            type="button"
            onClick={() => submit("published")}
            disabled={submitting || title.trim().length < 2}
          >
            {submitting ? "Publishing…" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- subcomponents ----------

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ScheduleFields(props: {
  scheduledAt: string;
  onScheduledAt: (v: string) => void;
  durationMinutes: string;
  onDurationMinutes: (v: string) => void;
  format: "in_person" | "online" | "hybrid";
  onFormat: (v: "in_person" | "online" | "hybrid") => void;
  location: string;
  onLocation: (v: string) => void;
  meetingUrl: string;
  onMeetingUrl: (v: string) => void;
}) {
  return (
    <div className="space-y-4 rounded-md border border-input bg-muted/10 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" required>
          <Input
            type="datetime-local"
            value={props.scheduledAt}
            onChange={(e) => props.onScheduledAt(e.target.value)}
          />
        </Field>
        <Field label="Duration (minutes)">
          <Input
            type="number"
            min="5"
            step="5"
            value={props.durationMinutes}
            onChange={(e) => props.onDurationMinutes(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Format">
        <Select
          value={props.format}
          onValueChange={(v) => props.onFormat(v as "in_person" | "online" | "hybrid")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="in_person">In person</SelectItem>
            <SelectItem value="hybrid">Hybrid</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {props.format !== "online" && (
        <Field label="Location">
          <Input
            value={props.location}
            onChange={(e) => props.onLocation(e.target.value)}
            placeholder="Address or venue name"
          />
        </Field>
      )}
      {props.format !== "in_person" && (
        <Field
          label="Meeting URL"
          hint="Or leave blank to use a Talk room created below."
        >
          <Input
            type="url"
            value={props.meetingUrl}
            onChange={(e) => props.onMeetingUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>
      )}
    </div>
  );
}

function RsvpAndTalkRow(props: {
  isRsvpEnabled: boolean;
  onIsRsvpEnabled: (v: boolean) => void;
  createTalkRoom: boolean;
  onCreateTalkRoom: (v: boolean) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex items-start gap-3 rounded-md border border-input bg-muted/20 p-3 text-sm">
        <Switch
          checked={props.isRsvpEnabled}
          onCheckedChange={props.onIsRsvpEnabled}
        />
        <span>
          <span className="font-medium">Enable RSVPs</span>
          <span className="block text-xs text-muted-foreground">
            Let attendees reserve a place.
          </span>
        </span>
      </label>
      <TalkRoomToggle
        createTalkRoom={props.createTalkRoom}
        onCreateTalkRoom={props.onCreateTalkRoom}
        compact
      />
    </div>
  );
}

function TalkRoomToggle(props: {
  createTalkRoom: boolean;
  onCreateTalkRoom: (v: boolean) => void;
  compact?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-input bg-muted/20 p-3 text-sm">
      <Switch
        checked={props.createTalkRoom}
        onCheckedChange={props.onCreateTalkRoom}
      />
      <span>
        <span className="font-medium">Create Talk room</span>
        <span className="block text-xs text-muted-foreground">
          {props.compact
            ? "Provision a Nextcloud Talk room for this gathering."
            : "Spin up a Nextcloud Talk discussion room attached to this post."}
        </span>
      </span>
    </label>
  );
}

function SessionsEditor({
  sessions,
  onChange,
}: {
  sessions: SessionInput[];
  onChange: (next: SessionInput[]) => void;
}) {
  function addSession() {
    onChange([
      ...sessions,
      {
        id: nanoid(8),
        title: "",
        scheduled_at: "",
        duration_minutes: 60,
        location: "",
        meeting_url: "",
      },
    ]);
  }
  function update(idx: number, patch: Partial<SessionInput>) {
    onChange(sessions.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function remove(idx: number) {
    onChange(sessions.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Additional sessions</p>
          <p className="text-xs text-muted-foreground">
            Optional. Add follow-up sessions for a multi-part workshop.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSession}
        >
          + Add session
        </Button>
      </div>

      {sessions.length > 0 && (
        <ul className="space-y-3">
          {sessions.map((s, idx) => (
            <li
              key={s.id}
              className={cn(
                "rounded-md border border-input bg-muted/10 p-3",
                "grid gap-3 sm:grid-cols-2"
              )}
            >
              <Field label={`Session ${idx + 1} title`}>
                <Input
                  value={s.title ?? ""}
                  onChange={(e) => update(idx, { title: e.target.value })}
                  placeholder={`e.g. Foundations`}
                />
              </Field>
              <Field label="Starts">
                <Input
                  type="datetime-local"
                  value={s.scheduled_at}
                  onChange={(e) =>
                    update(idx, { scheduled_at: e.target.value })
                  }
                />
              </Field>
              <Field label="Duration (min)">
                <Input
                  type="number"
                  min="5"
                  step="5"
                  value={s.duration_minutes ?? ""}
                  onChange={(e) =>
                    update(idx, {
                      duration_minutes: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
              </Field>
              <Field label="Location or link">
                <Input
                  value={s.location || s.meeting_url || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^https?:\/\//.test(v)) {
                      update(idx, { meeting_url: v, location: "" });
                    } else {
                      update(idx, { location: v, meeting_url: "" });
                    }
                  }}
                  placeholder="Address or https://…"
                />
              </Field>
              <div className="sm:col-span-2 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(idx)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

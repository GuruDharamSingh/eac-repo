"use client";

import * as React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { workshopFullSchema, type WorkshopFullInput } from "@/lib/cms/schema";
import { saveWorkshopAction } from "@/lib/cms/actions";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { CoverImageUpload } from "@/components/hub/CoverImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

// ─── Attendee-change warning modal ────────────────────────────────────────────

function AttendeeChangeModal({
  changedFields,
  onConfirm,
  onCancel,
}: {
  changedFields: string[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const labels: Record<string, string> = {
    scheduled_at: "date / time",
    location: "location",
    format: "format (in-person / online)",
    registration_status: "registration status",
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg">
        <h2 className="font-serif text-xl">Notify enrolled attendees?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You changed{" "}
          <strong>
            {changedFields.map((f) => labels[f] ?? f).join(", ")}
          </strong>
          . Enrolled attendees may need to know about this.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Attendee notification emails are not yet automated — please reach out
          directly to anyone who has registered.
        </p>
        <div className="mt-5 flex gap-3">
          <Button onClick={onConfirm}>Understood, save anyway</Button>
          <Button variant="outline" onClick={onCancel}>
            Go back and review
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Field group helpers ──────────────────────────────────────────────────────

function FieldRow({
  label,
  hint,
  children,
  error,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6 border-b border-border pb-4">
      <h3 className="font-serif text-lg text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

// ─── WorkshopForm ────────────────────────────────────────────────────────────

export type WorkshopFormProps = {
  orgSlug: string;
  /** Present when editing an existing workshop. */
  defaultValues?: Partial<WorkshopFullInput>;
};

export function WorkshopForm({ orgSlug, defaultValues }: WorkshopFormProps) {
  const router = useRouter();
  const isEditing = Boolean(defaultValues?.thread_id);

  const form = useForm<WorkshopFullInput>({
    resolver: zodResolver(workshopFullSchema),
    defaultValues: {
      orgSlug,
      status: "draft",
      visibility: "PUBLIC",
      share_to_network: false,
      is_rsvp_enabled: true,
      format: "online",
      currency: "USD",
      registration_status: "open",
      language: "English",
      optional_sections: {},
      sessions: [],
      ...defaultValues,
    },
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const { fields: sessionFields, append: addSession, remove: removeSession } =
    useFieldArray({ control, name: "sessions" });

  const [pendingSubmit, setPendingSubmit] = React.useState<WorkshopFullInput | null>(null);
  const [attendeeWarning, setAttendeeWarning] = React.useState<string[]>([]);

  const formatValue = watch("format");
  const statusValue = watch("status");

  async function doSave(data: WorkshopFullInput) {
    let result: Awaited<ReturnType<typeof saveWorkshopAction>>;
    try {
      result = await saveWorkshopAction(data);
    } catch (err) {
      console.error("[WorkshopForm] saveWorkshopAction threw:", err);
      toast.error("Save failed — check the browser console for details.");
      return;
    }
    if (result.ok === false) {
      toast.error(result.error);
      return;
    }
    if (result.attendeeChangeWarning && result.attendeeChangeWarning.length > 0) {
      toast.warning(
        `Saved. Note: you changed ${result.attendeeChangeWarning.join(", ")} — please notify enrolled attendees.`
      );
    } else {
      const published = data.status === "published";
      const publicUrl = published
        ? `http://${orgSlug}.localhost:3007/${result.slug}`
        : null;
      toast.success(
        published
          ? `Published. ${publicUrl ? `View it at ${publicUrl}` : ""}`
          : isEditing
          ? "Draft saved."
          : "Workshop created.",
        { duration: 5000 }
      );
    }
    if (!isEditing) {
      router.push(`/hub/workshops/${orgSlug}/${result.thread_id}`);
    } else {
      router.refresh();
    }
  }

  async function onSubmit(data: WorkshopFullInput) {
    if (isEditing && attendeeWarning.length > 0) {
      setPendingSubmit(data);
      return;
    }
    await doSave(data);
  }

  return (
    <>
      {attendeeWarning.length > 0 && pendingSubmit && (
        <AttendeeChangeModal
          changedFields={attendeeWarning}
          onConfirm={async () => {
            setAttendeeWarning([]);
            await doSave(pendingSubmit);
            setPendingSubmit(null);
          }}
          onCancel={() => {
            setPendingSubmit(null);
          }}
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
        {/* Ensures thread_id is in the RHF submit payload for the UPDATE path */}
        <input type="hidden" {...register("thread_id")} />

        {/* Sticky action bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-6 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="truncate font-serif text-base text-foreground">
              {watch("title") || (isEditing ? "Edit workshop" : "New workshop")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {orgSlug} ·{" "}
              {statusValue === "published" ? (
                <span className="text-green-600">Published</span>
              ) : (
                <span>Draft</span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => form.setValue("status", "draft")}
            >
              Save draft
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              onClick={() => form.setValue("status", "published")}
            >
              {isEditing ? "Update" : "Publish"}
            </Button>
          </div>
        </div>

        <div className="px-6 py-6">
          <Tabs defaultValue="core">
            <TabsList className="mb-6 flex w-full flex-wrap gap-1 bg-transparent p-0">
              {[
                ["core", "Core"],
                ["description", "Description"],
                ["schedule", "Schedule"],
                ["pricing", "Pricing"],
                ["registration", "Registration"],
                ["media", "Media"],
                ["seo", "SEO"],
                ["sections", "Sections"],
              ].map(([value, label]) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="rounded-md border border-border px-3 py-1.5 text-xs data-[state=active]:bg-foreground data-[state=active]:text-background"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── Core ───────────────────────────────────────────────────── */}
            <TabsContent value="core" className="space-y-5">
              <SectionHeader
                title="Core information"
                description="The essentials. These fields populate the hero, detail strip, and registration block."
              />

              <FieldRow label="Title" error={errors.title?.message}>
                <Input
                  {...register("title")}
                  placeholder="Writing as a Practice, Not a Product"
                  className="font-serif text-lg"
                />
              </FieldRow>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Subtitle" hint="One line under the title">
                  <Input {...register("subtitle")} placeholder="A 6-week writing series" />
                </FieldRow>
                <FieldRow label="Discipline / category">
                  <Input {...register("discipline")} placeholder="Creative writing" />
                </FieldRow>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Series label" hint="e.g. 'Spring 2026 cohort'">
                  <Input {...register("series_label")} placeholder="Spring 2026" />
                </FieldRow>
                <FieldRow label="Recurrence" hint="Displayed as a meta pill on the hero">
                  <Input
                    {...register("recurrence_label")}
                    placeholder="Saturdays 10am–1pm"
                  />
                </FieldRow>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FieldRow label="Starts" error={errors.scheduled_at?.message}>
                  <Input
                    {...register("scheduled_at")}
                    type="datetime-local"
                  />
                </FieldRow>
                <FieldRow label="Duration (minutes)" error={errors.duration_minutes?.message}>
                  <Input
                    {...register("duration_minutes")}
                    type="number"
                    placeholder="180"
                  />
                </FieldRow>
                <FieldRow label="Format">
                  <Controller
                    control={control}
                    name="format"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_person">In-person</SelectItem>
                          <SelectItem value="online">Online</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FieldRow>
              </div>

              {(formatValue === "in_person" || formatValue === "hybrid") && (
                <FieldRow label="Location (short)" hint="Shown in the hero meta pill">
                  <Input
                    {...register("location")}
                    placeholder="EAC Studio, Toronto"
                  />
                </FieldRow>
              )}

              {(formatValue === "online" || formatValue === "hybrid") && (
                <FieldRow label="Meeting URL" hint="Shown to enrolled participants only">
                  <Input
                    {...register("meeting_url")}
                    type="url"
                    placeholder="https://us02web.zoom.us/j/..."
                  />
                </FieldRow>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <FieldRow label="Level">
                  <Controller
                    control={control}
                    name="level"
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(v) => field.onChange(v || undefined)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Any level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_levels">All levels</SelectItem>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FieldRow>
                <FieldRow label="Language">
                  <Input {...register("language")} placeholder="English" />
                </FieldRow>
                <FieldRow label="Capacity" hint="Max attendees" error={errors.attendee_limit?.message}>
                  <Input
                    {...register("attendee_limit")}
                    type="number"
                    placeholder="12"
                  />
                </FieldRow>
              </div>
            </TabsContent>

            {/* ── Description ────────────────────────────────────────────── */}
            <TabsContent value="description" className="space-y-5">
              <SectionHeader
                title="Description"
                description="Full workshop description (rich text) and a short excerpt for listings."
              />

              <FieldRow label="Short description" hint="Up to 500 chars — used in listings and as the hero excerpt">
                <Textarea
                  {...register("description_short")}
                  placeholder="A brief, compelling summary for listings…"
                  rows={3}
                />
              </FieldRow>

              <FieldRow label="Full description" hint="Rich text — appears in the About section">
                <Controller
                  control={control}
                  name="body"
                  render={({ field }) => (
                    <RichTextEditor
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="Write a full description of the workshop…"
                      minHeight={240}
                    />
                  )}
                />
              </FieldRow>

              <FieldRow
                label="Accessibility notes"
                hint="Location access, language support, accommodations — collapsed by default on the public page"
              >
                <Textarea
                  {...register("accessibility_notes")}
                  placeholder="This workshop takes place on the second floor…"
                  rows={3}
                />
              </FieldRow>

              <FieldRow
                label="Facilitator note"
                hint="Overrides your artist profile bio for this workshop only"
              >
                <Textarea
                  {...register("author_note")}
                  placeholder="Optional bio override specific to this offering…"
                  rows={3}
                />
              </FieldRow>
            </TabsContent>

            {/* ── Schedule ───────────────────────────────────────────────── */}
            <TabsContent value="schedule" className="space-y-5">
              <SectionHeader
                title="Session schedule"
                description="Multi-session breakdown. Leave empty if the workshop is a single event."
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Number of sessions" error={errors.session_count?.message}>
                  <Input
                    {...register("session_count")}
                    type="number"
                    placeholder="6"
                  />
                </FieldRow>
                <FieldRow label="Duration per session (hours)" error={errors.session_duration_hrs?.message}>
                  <Input
                    {...register("session_duration_hrs")}
                    type="number"
                    step="0.25"
                    placeholder="3"
                  />
                </FieldRow>
              </div>

              <FieldRow label="Recurrence label" hint="Descriptive — also shown on the hero">
                <Input
                  {...register("recurrence_label")}
                  placeholder="Saturdays 10am–1pm"
                />
              </FieldRow>

              {sessionFields.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    Individual sessions
                  </p>
                  {sessionFields.map((session, index) => (
                    <div
                      key={session.id}
                      className="rounded-md border border-border p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">
                          Session {index + 1}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSession(index)}
                          className="text-xs text-muted-foreground"
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FieldRow label="Title">
                          <Input
                            {...register(`sessions.${index}.title`)}
                            placeholder="Session title"
                          />
                        </FieldRow>
                        <FieldRow label="Starts">
                          <Input
                            {...register(`sessions.${index}.scheduled_at`)}
                            type="datetime-local"
                          />
                        </FieldRow>
                        <FieldRow label="Duration (min)">
                          <Input
                            {...register(`sessions.${index}.duration_minutes`)}
                            type="number"
                            placeholder="180"
                          />
                        </FieldRow>
                        <FieldRow label="Location override">
                          <Input
                            {...register(`sessions.${index}.location`)}
                            placeholder="Same as main location"
                          />
                        </FieldRow>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  addSession({
                    id: crypto.randomUUID(),
                    scheduled_at: "",
                  })
                }
              >
                + Add session
              </Button>
            </TabsContent>

            {/* ── Pricing ────────────────────────────────────────────────── */}
            <TabsContent value="pricing" className="space-y-5">
              <SectionHeader
                title="Pricing"
                description="Full price, sliding scale range, and member pricing."
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Full price">
                  <Input
                    {...register("price")}
                    type="number"
                    step="0.01"
                    placeholder="180"
                  />
                </FieldRow>
                <FieldRow label="Currency">
                  <Controller
                    control={control}
                    name="currency"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CAD">CAD</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FieldRow>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Sliding scale minimum">
                  <Input
                    {...register("price_sliding_min")}
                    type="number"
                    step="0.01"
                    placeholder="90"
                  />
                </FieldRow>
                <FieldRow label="Member price">
                  <Input
                    {...register("price_member")}
                    type="number"
                    step="0.01"
                    placeholder="140"
                  />
                </FieldRow>
              </div>

              <FieldRow
                label="Sliding scale note"
                hint="Shown beneath the price on the registration block"
              >
                <Textarea
                  {...register("sliding_scale_note")}
                  placeholder="Reach out if cost is a barrier — no questions asked."
                  rows={2}
                />
              </FieldRow>
            </TabsContent>

            {/* ── Registration ───────────────────────────────────────────── */}
            <TabsContent value="registration" className="space-y-5">
              <SectionHeader
                title="Registration"
                description="External registration link, deadline, and status."
              />

              <FieldRow label="Registration URL" hint="Where people go to sign up">
                <Input
                  {...register("registration_url")}
                  type="url"
                  placeholder="https://..."
                />
              </FieldRow>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Registration deadline">
                  <Input {...register("registration_deadline")} type="date" />
                </FieldRow>
                <FieldRow label="Registration status">
                  <Controller
                    control={control}
                    name="registration_status"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="waitlist">Waitlist</SelectItem>
                          <SelectItem value="full">Full</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FieldRow>
              </div>

              <div className="flex items-center gap-3 rounded-md border border-border p-3">
                <Controller
                  control={control}
                  name="is_rsvp_enabled"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id="rsvp-toggle"
                    />
                  )}
                />
                <label
                  htmlFor="rsvp-toggle"
                  className="cursor-pointer text-sm text-foreground"
                >
                  Enable RSVP on this platform
                </label>
              </div>

              <FieldRow label="Full address" hint="Full address for in-person — also used in the about section">
                <Textarea
                  {...register("location_address")}
                  placeholder="123 Queen St W, Toronto, ON M5H 2M9"
                  rows={2}
                />
              </FieldRow>
            </TabsContent>

            {/* ── Media ──────────────────────────────────────────────────── */}
            <TabsContent value="media" className="space-y-5">
              <SectionHeader
                title="Media"
                description="Cover image and promo video for the workshop page."
              />

              <FieldRow label="Cover image" hint="Used as hero background on the workshop page">
                <Controller
                  control={control}
                  name="cover_image_url"
                  render={({ field }) => (
                    <CoverImageUpload
                      orgSlug={orgSlug}
                      kind="image"
                      value={field.value || undefined}
                      onChange={(url) => field.onChange(url ?? "")}
                    />
                  )}
                />
              </FieldRow>

              <FieldRow label="Promo video" hint="Uploaded video embedded in the gallery section">
                <Controller
                  control={control}
                  name="promo_video_url"
                  render={({ field }) => (
                    <CoverImageUpload
                      orgSlug={orgSlug}
                      kind="video"
                      value={field.value || undefined}
                      onChange={(url) => field.onChange(url ?? "")}
                    />
                  )}
                />
              </FieldRow>
            </TabsContent>

            {/* ── SEO ────────────────────────────────────────────────────── */}
            <TabsContent value="seo" className="space-y-5">
              <SectionHeader
                title="SEO & sharing"
                description="Overrides for search results and social sharing."
              />

              <FieldRow label="SEO title" hint="Defaults to workshop title if empty · max 70 chars">
                <Input
                  {...register("seo_title")}
                  placeholder="Writing as a Practice — EAC Workshop"
                />
              </FieldRow>

              <FieldRow label="Meta description" hint="Max 160 chars">
                <Textarea
                  {...register("seo_description")}
                  placeholder="A 6-week series exploring writing as a living practice…"
                  rows={2}
                />
              </FieldRow>

              <FieldRow label="OG image URL">
                <Input
                  {...register("og_image_url")}
                  type="url"
                  placeholder="https://..."
                />
              </FieldRow>
            </TabsContent>

            {/* ── Sections ───────────────────────────────────────────────── */}
            <TabsContent value="sections" className="space-y-5">
              <SectionHeader
                title="Optional sections"
                description="Toggle which sections appear on the public workshop page. Required sections cannot be hidden."
              />

              {[
                {
                  id: "eac-ws-schedule",
                  label: "Session schedule",
                  hint: "Shown automatically when sessions are added",
                },
                {
                  id: "eac-ws-gallery",
                  label: "Media gallery",
                  hint: "Shown when gallery images or a promo video are added",
                },
                {
                  id: "eac-ws-testimonials",
                  label: "Participant quotes",
                  hint: "Future — requires testimonials table",
                  disabled: true,
                },
                {
                  id: "eac-ws-related",
                  label: "Related workshops",
                  hint: "Auto-populated from same discipline",
                },
              ].map(({ id, label, hint, disabled }) => (
                <div
                  key={id}
                  className="flex items-center justify-between rounded-md border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    {hint && (
                      <p className="text-xs text-muted-foreground">{hint}</p>
                    )}
                  </div>
                  <Controller
                    control={control}
                    name={`optional_sections.${id}`}
                    render={({ field }) => (
                      <Switch
                        checked={Boolean(field.value)}
                        onCheckedChange={field.onChange}
                        disabled={disabled}
                      />
                    )}
                  />
                </div>
              ))}

              <div className="space-y-3 border-t border-border pt-4">
                <SectionHeader
                  title="Publishing"
                  description="Visibility and network sharing."
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldRow label="Visibility">
                    <Controller
                      control={control}
                      name="visibility"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PUBLIC">Public</SelectItem>
                            <SelectItem value="ORGANIZATION">Members only</SelectItem>
                            <SelectItem value="INVITE_ONLY">Invite only</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FieldRow>
                </div>

                <div className="flex items-center gap-3 rounded-md border border-border p-3">
                  <Controller
                    control={control}
                    name="share_to_network"
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="network-toggle"
                      />
                    )}
                  />
                  <label
                    htmlFor="network-toggle"
                    className="cursor-pointer text-sm text-foreground"
                  >
                    Share to network feed
                  </label>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </form>
    </>
  );
}

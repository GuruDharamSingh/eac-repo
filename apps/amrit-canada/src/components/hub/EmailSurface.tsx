"use client";

// ============================================================================
// SUPERSEDED IN PART — 2026-09-17.
//
// The email SUITE is now `@elkdonis/cms-ui/email` (face + surface + the page at
// arts-collective.com/hub/email). It carries everything this pair used to be
// the only home for, and four things it never had: an inbox for mail that
// comes back, an address book merged across contacts/members/RSVP guests, a
// delivery ledger, and the org's own palette.
//
// This file is KEPT because it still does one thing the shared suite does not:
// per-thread email — choosing a meeting, writing its confirmation body,
// triggering a blast to that meeting's attendees, and setting its automatic
// reminder. Those run against amrit-canada's own routes
// (/api/threads/[id]/email-settings, /trigger-email, /reminder).
//
// DO NOT extend this file. When per-thread email is folded into the shared
// suite it becomes a sixth tab there, and this pair is deleted along with the
// `email` custom-surface key in HubSurfaces.tsx — which is the same key the
// shared suite registers, so the two can never be mounted in one app.
// ============================================================================

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SurfaceFrame, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import type { EmailMediaItem } from "@elkdonis/email";
import type { EmailThreadOption } from "./EmailFace";
import type { EmailTemplateConfig } from "@/lib/email-template-settings";
import type { Material } from "@/lib/types";
import { Button, Textarea, Checkbox, Switch, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger, TabsContent } from "@elkdonis/primitives";

type TriggerType = "confirmation" | "reminder" | "cancellation";
type Audience = "rsvp" | "custom";

function formatWhen(iso: string | null): string {
  if (!iso) return "no date set";
  try {
    return new Date(iso).toLocaleDateString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "no date set";
  }
}

export function EmailSurface({
  descriptor,
}: {
  descriptor: Extract<SurfaceDescriptor, { type: "custom" }>;
}) {
  const threads = ((descriptor.props?.threads as EmailThreadOption[] | undefined) ?? []).slice();

  const [threadId, setThreadId] = useState<string>(threads[0]?.id ?? "");
  const thread = threads.find((t) => t.id === threadId) ?? null;

  // Write tab
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [bodyText, setBodyText] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set());
  const [media, setMedia] = useState<EmailMediaItem[]>([]);
  const [recipientsText, setRecipientsText] = useState("");
  const [savingWrite, setSavingWrite] = useState(false);

  // Trigger tab
  const [triggerType, setTriggerType] = useState<TriggerType>("reminder");
  const [audience, setAudience] = useState<Audience>("rsvp");
  const [sending, setSending] = useState(false);

  // Make tab
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDays, setReminderDays] = useState(1);
  const [savingReminder, setSavingReminder] = useState(false);

  useEffect(() => {
    if (!threadId) return;
    setLoadingConfig(true);
    fetch(`/api/threads/${threadId}/email-settings`)
      .then((res) => res.json())
      .then((data: { config?: EmailTemplateConfig; materials?: Material[] }) => {
        const config = data.config ?? {};
        setBodyText(config.bodyText ?? "");
        setMedia(config.media ?? []);
        setRecipientsText((config.recipients ?? []).join("\n"));
        const allMaterials = data.materials ?? [];
        setMaterials(allMaterials);
        setSelectedMaterialIds(
          new Set(config.materialIds?.length ? config.materialIds : allMaterials.map((m) => m.id))
        );
      })
      .catch(() => toast.error("Couldn't load this thread's email settings."))
      .finally(() => setLoadingConfig(false));

    const t = threads.find((x) => x.id === threadId);
    setReminderEnabled(t?.reminderMinutesBefore != null);
    setReminderDays(t?.reminderMinutesBefore ? Math.max(1, Math.round(t.reminderMinutesBefore / 1440)) : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  async function saveWrite() {
    if (!threadId) return;
    setSavingWrite(true);
    try {
      const config: EmailTemplateConfig = {
        bodyText,
        media,
        materialIds: Array.from(selectedMaterialIds),
        recipients: recipientsText.split("\n"),
      };
      const res = await fetch(`/api/threads/${threadId}/email-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRecipientsText((data.config?.recipients ?? []).join("\n"));
      toast.success("Saved.");
    } catch {
      toast.error("Couldn't save. Try again.");
    } finally {
      setSavingWrite(false);
    }
  }

  async function sendNow() {
    if (!threadId) return;
    if (!confirm(`Send this ${triggerType} email now?`)) return;
    setSending(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/trigger-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: triggerType, audience }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      if (data.sent === 0) {
        toast.message(data.message ?? "Nobody to send to.");
      } else {
        toast.success(`Sent to ${data.sent}${data.failed ? ` (${data.failed} failed)` : ""}.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function saveReminder() {
    if (!threadId) return;
    setSavingReminder(true);
    try {
      const minutesBefore = reminderEnabled ? reminderDays * 1440 : null;
      const res = await fetch(`/api/threads/${threadId}/reminder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutesBefore }),
      });
      if (!res.ok) throw new Error();
      toast.success(reminderEnabled ? `Reminder set for ${reminderDays} day(s) before.` : "Reminder turned off.");
    } catch {
      toast.error("Couldn't save. Try again.");
    } finally {
      setSavingReminder(false);
    }
  }

  const recipientCount = recipientsText.split("\n").map((l) => l.trim()).filter(Boolean).length;

  return (
    <SurfaceFrame kind="neutral" title="Email" kicker="Confirmations, triggers & reminders">
      <div className="space-y-5">
        <div>
          <Label htmlFor="email-thread">Meeting</Label>
          <Select value={threadId} onValueChange={setThreadId}>
            <SelectTrigger id="email-thread" className="mt-1 w-full">
              <SelectValue placeholder="Choose a meeting" />
            </SelectTrigger>
            <SelectContent>
              {threads.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title} · {formatWhen(t.scheduledAt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!thread ? (
          <p className="text-sm text-muted-foreground">No meetings to email yet.</p>
        ) : (
          <Tabs defaultValue="write">
            <TabsList>
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="trigger">Trigger</TabsTrigger>
              <TabsTrigger value="make">Make</TabsTrigger>
            </TabsList>

            <TabsContent value="write" className="space-y-4 pt-4">
              {loadingConfig ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <>
                  <div>
                    <Label htmlFor="email-body">Message</Label>
                    <Textarea
                      id="email-body"
                      className="mt-1"
                      rows={5}
                      placeholder="Bring a mat and an open heart…"
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                    />
                  </div>

                  {materials.length > 0 && (
                    <div>
                      <Label>Materials to include</Label>
                      <div className="mt-2 space-y-2">
                        {materials.map((m) => (
                          <label key={m.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={selectedMaterialIds.has(m.id)}
                              onCheckedChange={(checked) => {
                                setSelectedMaterialIds((prev) => {
                                  const next = new Set(prev);
                                  if (checked) next.add(m.id);
                                  else next.delete(m.id);
                                  return next;
                                });
                              }}
                            />
                            {m.filename}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label>Insert images</Label>
                    <div className="mt-2 space-y-3">
                      {media.map((item, index) => (
                        <div key={index} className="rounded-md border p-3">
                          <MediaPicker
                            value={item.url}
                            onChange={(url) =>
                              setMedia((prev) => prev.map((m, i) => (i === index ? { ...m, url } : m)))
                            }
                            uploadEndpoint="/api/upload"
                            libraryEndpoint="/api/media/library"
                            label="Image"
                          />
                          <input
                            className="mt-2 w-full rounded-md border px-2 py-1 text-sm"
                            placeholder="Caption (optional)"
                            value={item.caption ?? ""}
                            onChange={(e) =>
                              setMedia((prev) =>
                                prev.map((m, i) => (i === index ? { ...m, caption: e.target.value } : m))
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            onClick={() => setMedia((prev) => prev.filter((_, i) => i !== index))}
                          >
                            Remove image
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMedia((prev) => [...prev, { url: "", alt: "", caption: "" }])}
                      >
                        + Add image
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email-recipients">Custom recipient list</Label>
                    <Textarea
                      id="email-recipients"
                      className="mt-1 font-mono text-sm"
                      rows={4}
                      placeholder={"one email address per line\njane@example.com"}
                      value={recipientsText}
                      onChange={(e) => setRecipientsText(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{recipientCount} saved</p>
                  </div>

                  <Button onClick={saveWrite} disabled={savingWrite}>
                    {savingWrite ? "Saving…" : "Save"}
                  </Button>
                </>
              )}
            </TabsContent>

            <TabsContent value="trigger" className="space-y-4 pt-4">
              <div>
                <Label>Send</Label>
                <Select value={triggerType} onValueChange={(v) => setTriggerType(v as TriggerType)}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmation">Confirmation</SelectItem>
                    <SelectItem value="reminder">Reminder</SelectItem>
                    <SelectItem value="cancellation">Cancellation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>To</Label>
                <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rsvp">Everyone who RSVP&rsquo;d yes (this cycle)</SelectItem>
                    <SelectItem value="custom">Custom list ({recipientCount} saved)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={sendNow} disabled={sending}>
                {sending ? "Sending…" : "Send now"}
              </Button>
            </TabsContent>

            <TabsContent value="make" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Switch checked={reminderEnabled} onCheckedChange={setReminderEnabled} />
                <Label>Send an automatic reminder</Label>
              </div>

              {reminderEnabled && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={14}
                    className="w-20 rounded-md border px-2 py-1 text-sm"
                    value={reminderDays}
                    onChange={(e) => setReminderDays(Math.max(1, Math.min(14, Number(e.target.value) || 1)))}
                  />
                  <span className="text-sm text-muted-foreground">day(s) before the meeting</span>
                </div>
              )}

              <Button onClick={saveReminder} disabled={savingReminder}>
                {savingReminder ? "Saving…" : "Save"}
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </SurfaceFrame>
  );
}

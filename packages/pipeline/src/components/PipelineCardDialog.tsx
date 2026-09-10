"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Check,
  Download,
  MessageSquare,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { DeckAttachment, DeckCard, DeckLabel } from "@elkdonis/nextcloud";
import type { OrgDeckComment } from "@elkdonis/services";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Textarea } from "../ui/textarea";
import { fromDateInputValue, labelTextColor, toDateInputValue } from "../deck-ui";

export interface CardPatch {
  title?: string;
  description?: string;
  duedate?: string | null;
}

export interface Assignee {
  uid: string;
  displayName: string;
}

interface CardActivity {
  id: number;
  subject: string;
  at: string;
}

/**
 * Deck's card detail, with the same four tabs it shows: Details, Attachments,
 * Comments, Activity. Attachments, comments and activity are fetched when the
 * dialog opens rather than shipped with the board — a board view doesn't need
 * them, and Deck loads them per card too.
 */
export function PipelineCardDialog({
  card,
  boardLabels,
  assignees,
  canWrite,
  canManage,
  onClose,
  onSave,
  onToggleLabel,
  onToggleAssignee,
  onToggleDone,
  onDelete,
}: {
  card: DeckCard | null;
  boardLabels: DeckLabel[];
  assignees: Assignee[];
  canWrite: boolean;
  canManage: boolean;
  onClose: () => void;
  onSave: (cardId: number, patch: CardPatch) => Promise<boolean>;
  onToggleLabel: (cardId: number, labelId: number, assigned: boolean) => void;
  onToggleAssignee: (cardId: number, uid: string, assigned: boolean) => void;
  onToggleDone: (cardId: number, done: boolean) => void;
  onDelete: (cardId: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);

  const [comments, setComments] = useState<OrgDeckComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<DeckAttachment[] | null>(null);
  const [activity, setActivity] = useState<CardActivity[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cardId = card?.id ?? null;

  useEffect(() => {
    if (!card) return;
    setTitle(card.title);
    setDescription(card.description ?? "");
    setDue(toDateInputValue(card.duedate));
    setComments(null);
    setAttachments(null);
    setActivity(null);
    setDraft("");
  }, [card]);

  const loadComments = useCallback(async () => {
    if (cardId === null) return;
    const res = await fetch(`/api/pipeline/cards/${cardId}/comments`);
    setComments(res.ok ? await res.json() : []);
  }, [cardId]);

  const loadAttachments = useCallback(async () => {
    if (cardId === null) return;
    const res = await fetch(`/api/pipeline/cards/${cardId}/attachments`);
    setAttachments(res.ok ? await res.json() : []);
  }, [cardId]);

  const loadActivity = useCallback(async () => {
    if (cardId === null) return;
    const res = await fetch(`/api/pipeline/cards/${cardId}/activity`);
    setActivity(res.ok ? await res.json() : []);
  }, [cardId]);

  if (!card || cardId === null) return null;

  const assignedLabelIds = new Set((card.labels ?? []).map((l) => l.id));
  const assignedUids = new Set((card.assignedUsers ?? []).map((a) => a.participant.uid));
  const isDone = Boolean(card.done);

  async function save() {
    const trimmed = title.trim();
    if (!trimmed || cardId === null) return;
    setSaving(true);
    const ok = await onSave(cardId, {
      title: trimmed,
      description,
      duedate: fromDateInputValue(due),
    });
    setSaving(false);
    if (ok) onClose();
  }

  async function postComment() {
    const message = draft.trim();
    if (!message || cardId === null) return;
    const res = await fetch(`/api/pipeline/cards/${cardId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) {
      toast.error("Could not post that comment.");
      return;
    }
    setDraft("");
    await loadComments();
  }

  async function upload(file: File) {
    if (cardId === null) return;
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/pipeline/cards/${cardId}/attachments`, { method: "POST", body });
    setUploading(false);
    if (!res.ok) {
      toast.error("Could not upload that file.");
      return;
    }
    await loadAttachments();
  }

  async function removeAttachment(attachmentId: number) {
    if (cardId === null) return;
    const res = await fetch(`/api/pipeline/cards/${cardId}/attachments/${attachmentId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Could not remove that file.");
      return;
    }
    await loadAttachments();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">{card.title}</DialogTitle>
          <DialogDescription>
            Changes save straight to the group&rsquo;s Nextcloud Deck board.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="details"
          onValueChange={(value) => {
            if (value === "comments" && comments === null) void loadComments();
            if (value === "attachments" && attachments === null) void loadAttachments();
            if (value === "activity" && activity === null) void loadActivity();
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="attachments">
              <Paperclip className="size-3.5" />
              Attachments
            </TabsTrigger>
            <TabsTrigger value="comments">
              <MessageSquare className="size-3.5" />
              Comments
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="size-3.5" />
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="card-title">Title</Label>
              <Input
                id="card-title"
                value={title}
                disabled={!canWrite}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1.5">
                {boardLabels.map((label) => {
                  const on = assignedLabelIds.has(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      disabled={!canWrite}
                      onClick={() => onToggleLabel(cardId, label.id, !on)}
                      className={`rounded px-2 py-0.5 text-xs font-medium transition-opacity ${
                        on ? "" : "opacity-40 hover:opacity-70"
                      }`}
                      style={{
                        backgroundColor: `#${label.color}`,
                        color: labelTextColor(label.color),
                      }}
                    >
                      {label.title}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Assigned to</Label>
              {assignees.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nobody on this board has a connected Nextcloud account yet. Deck can only assign
                  cards to Nextcloud users, so assignment stays empty until someone connects theirs.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {assignees.map((person) => {
                    const on = assignedUids.has(person.uid);
                    return (
                      <button
                        key={person.uid}
                        type="button"
                        disabled={!canWrite}
                        onClick={() => onToggleAssignee(cardId, person.uid, !on)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs ${
                          on ? "border-primary bg-primary/10" : "text-muted-foreground"
                        }`}
                      >
                        {person.displayName}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="card-due">Due date</Label>
                <Input
                  id="card-due"
                  type="date"
                  value={due}
                  disabled={!canWrite}
                  onChange={(e) => setDue(e.target.value)}
                  className="w-44"
                />
              </div>
              {canWrite && (
                <Button
                  variant={isDone ? "default" : "outline"}
                  onClick={() => onToggleDone(cardId, !isDone)}
                >
                  <Check className="size-4" />
                  {isDone ? "Done" : "Mark as done"}
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="card-description">Description</Label>
              <Textarea
                id="card-description"
                rows={6}
                value={description}
                disabled={!canWrite}
                placeholder="Notes, links, next steps…"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex justify-between gap-2 pt-2">
              {canManage ? (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (window.confirm("Delete this card from the Nextcloud board?")) {
                      onDelete(cardId);
                      onClose();
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose}>
                  Close
                </Button>
                {canWrite && (
                  <Button onClick={() => void save()} disabled={saving || !title.trim()}>
                    Save
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="attachments" className="space-y-3 pt-4">
            {canWrite && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="size-4" />
                  {uploading ? "Uploading…" : "Upload new files"}
                </Button>
              </>
            )}

            {attachments === null ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files on this card yet.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{a.data}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {formatSize(a.extendedData?.filesize)}
                    </span>
                    <a
                      href={`/api/pipeline/cards/${cardId}/attachments/${a.id}`}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label={`Download ${a.data}`}
                    >
                      <Download className="size-4" />
                    </a>
                    {canManage && (
                      <button
                        type="button"
                        aria-label={`Remove ${a.data}`}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => void removeAttachment(a.id)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="comments" className="space-y-3 pt-4">
            {comments === null ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No comments yet. Begin the discussion!</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium">{c.authorName}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleString("en-CA")}
                      </span>
                      {c.fromNextcloud && (
                        <span className="text-xs text-muted-foreground">· from Nextcloud</span>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{c.message}</p>
                  </li>
                ))}
              </ul>
            )}

            {canWrite && (
              <div className="space-y-2">
                <Textarea
                  rows={3}
                  value={draft}
                  placeholder="Write a message …"
                  onChange={(e) => setDraft(e.target.value)}
                />
                <Button disabled={!draft.trim()} onClick={() => void postComment()}>
                  Post comment
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="pt-4">
            {activity === null ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing recorded for this card yet.</p>
            ) : (
              <ul className="space-y-2">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex gap-3 text-sm">
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(entry.at).toLocaleString("en-CA")}
                    </span>
                    <span>{entry.subject}</span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { OrgChatIdentity } from "@elkdonis/services";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

/**
 * "Posting as <name>", with the option to change it.
 *
 * Worth offering because of how the name is derived: members post through a
 * Talk guest account, and when their profile has no display name the fallback
 * is their email address — which nobody should have broadcast to a room
 * without being asked.
 *
 * Changing it is retroactive: Talk resolves a guest's name when a message is
 * READ, so the new name also appears on messages this session already sent.
 * The edit box says so, because a rename that silently rewrites history is
 * not what anyone expects from a chat.
 */
export function ChatIdentity({
  identity,
  onChange,
  endpoint = "/api/chat/identity",
}: {
  identity: OrgChatIdentity;
  onChange?: (identity: OrgChatIdentity) => void;
  endpoint?: string;
}) {
  const [current, setCurrent] = useState(identity);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(identity.displayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const displayName = draft.trim();
    if (!displayName || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      if (!res.ok) {
        setError("Could not change that name.");
        return;
      }
      const next: OrgChatIdentity = await res.json();
      setCurrent(next);
      setEditing(false);
      onChange?.(next);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus
            value={draft}
            maxLength={64}
            aria-label="The name your messages show"
            className="h-7 max-w-48 text-xs"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void save();
              }
              if (e.key === "Escape") {
                setEditing(false);
                setDraft(current.displayName);
              }
            }}
          />
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label="Save name"
            disabled={saving || !draft.trim()}
            onClick={() => void save()}
          >
            <Check className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label="Cancel"
            onClick={() => {
              setEditing(false);
              setDraft(current.displayName);
            }}
          >
            <X className="size-3.5" />
          </Button>
          {error && <span className="text-[11px] text-destructive">{error}</span>}
        </div>
        <p className="text-[11px] text-muted-foreground">
          This also renames you on messages you&rsquo;ve already sent here.
        </p>
      </div>
    );
  }

  return (
    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
      Posting as <span className="font-medium text-foreground">{current.displayName}</span>
      <button
        type="button"
        aria-label="Change the name your messages show"
        className="inline-flex items-center hover:text-foreground"
        onClick={() => {
          setDraft(current.displayName);
          setEditing(true);
        }}
      >
        <Pencil className="size-3" />
      </button>
    </p>
  );
}

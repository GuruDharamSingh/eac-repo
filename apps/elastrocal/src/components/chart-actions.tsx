"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { withBase } from "@/lib/base-path";
import { Input } from "@/components/ui/input";

async function patch(id: string, body: object): Promise<void> {
  const res = await fetch(withBase(`/api/charts/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Update failed");
}

/** Title row for a saved chart: rename in place, favourite, delete. */
export function ChartActions({ id, name, isFavorite }: { id: string; name: string; isFavorite: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>, success?: string) {
    setBusy(true);
    try {
      await action();
      if (success) toast.success(success);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {editing ? (
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await patch(id, { name: draft.trim() });
              setEditing(false);
            });
          }}
        >
          <Input autoFocus required maxLength={200} value={draft} onChange={(e) => setDraft(e.target.value)} className="max-w-md" />
          <Button type="submit" disabled={busy || !draft.trim()}>
            Save
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <h1 className="text-3xl font-semibold md:text-4xl">{name}</h1>
      )}

      <div className="flex gap-2">
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Rename
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => run(() => patch(id, { isFavorite: !isFavorite }))}
          aria-pressed={isFavorite}
        >
          <Star className={isFavorite ? "size-4 fill-primary text-primary" : "size-4"} />
          {isFavorite ? "Favourite" : "Add to favourites"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            if (!window.confirm(`Delete “${name}”? This can't be undone.`)) return;
            setBusy(true);
            fetch(withBase(`/api/charts/${id}`), { method: "DELETE" })
              .then((res) => {
                if (!res.ok) throw new Error("Delete failed");
                toast.success("Chart deleted");
                router.push("/charts");
                router.refresh();
              })
              .catch((err) => {
                toast.error(err.message);
                setBusy(false);
              });
          }}
        >
          <Trash2 className="size-4" /> Delete
        </Button>
      </div>
    </div>
  );
}

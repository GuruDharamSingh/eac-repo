"use client";

import * as React from "react";
import { toast } from "sonner";
import type { Review, ReviewList, ReviewTarget } from "@/lib/catalogue-types";
import {
  deleteOwnReviewAction,
  listReviewsAction,
  saveReviewAction,
  setReviewHiddenAction,
} from "@/lib/review-actions";

function errText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

function Stars({ value, size = "text-sm" }: { value: number; size?: string }) {
  const full = Math.round(value);
  return (
    <span className={`${size} tracking-tight text-amber-600`} aria-label={`${value} out of 5`}>
      {"★".repeat(full)}
      <span className="text-muted-foreground/40">{"★".repeat(5 - full)}</span>
    </span>
  );
}

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

/**
 * Reviews of a place, tour or experience: the summary, the list, and a write
 * box when the viewer may review (signed-in followers and up). Signed-in
 * visitors who do not follow yet get a one-click Follow; signed-out ones a
 * sign-in link. Editors see hidden reviews and can hide or show any of them.
 * Loads itself (listReviewsAction is public), so it works on a page and in a popup.
 */
export function ReviewsSection({
  target,
  title = "Reviews",
  compact = false,
}: {
  target: ReviewTarget;
  title?: string;
  /** Smaller type and no heading rule, for popups and catalogue rows. */
  compact?: boolean;
}) {
  const [list, setList] = React.useState<ReviewList | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const load = React.useCallback(async () => {
    try {
      setList(await listReviewsAction(target));
      setError(null);
    } catch (e) {
      setError(errText(e, "Reviews could not be loaded."));
    }
    // target is a value object; key on its parts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.type, target.id]);
  React.useEffect(() => {
    void load();
  }, [load]);

  const headingCls = compact ? "text-sm font-medium" : "font-serif text-2xl";
  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!list) return <p className="text-sm text-muted-foreground">Loading reviews…</p>;

  const { summary, viewer, reviews } = list;
  const mine = reviews.find((r) => r.mine) ?? null;
  const others = reviews.filter((r) => !r.mine);

  return (
    <section className={compact ? "space-y-3" : "space-y-5"} aria-label={title}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className={headingCls}>{title}</h2>
        {summary.average != null ? (
          <span className="flex items-baseline gap-2 text-sm">
            <Stars value={summary.average} />
            <span>
              {summary.average.toFixed(1)} from {summary.ratedCount} rating{summary.ratedCount === 1 ? "" : "s"}
            </span>
          </span>
        ) : null}
        <span className="text-sm text-muted-foreground">
          {summary.count === 0 ? "No reviews yet" : `${summary.count} review${summary.count === 1 ? "" : "s"}`}
        </span>
      </div>

      {viewer.canReview ? (
        <WriteBox key={mine?.id ?? "new"} target={target} mine={mine} onSaved={load} compact={compact} />
      ) : viewer.signedIn ? (
        <FollowPrompt onFollowed={load} />
      ) : (
        <p className="text-sm text-muted-foreground">
          <a
            href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`}
            className="underline underline-offset-4"
          >
            Sign in
          </a>{" "}
          and follow us to leave a review.
        </p>
      )}

      {others.length > 0 && (
        <ul className={`divide-y divide-border ${compact ? "text-sm" : ""}`}>
          {others.map((r) => (
            <ReviewItem key={r.id} review={r} canModerate={viewer.canModerate} onChanged={load} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewItem({ review: r, canModerate, onChanged }: { review: Review; canModerate: boolean; onChanged: () => void }) {
  const [busy, setBusy] = React.useState(false);
  async function toggleHidden() {
    const hide = r.status !== "hidden";
    const reason = hide ? window.prompt("Why hide it? (kept for editors)") : undefined;
    if (hide && reason === null) return;
    setBusy(true);
    const res = await setReviewHiddenAction(r.id, hide, reason || undefined).catch((e: unknown) => ({ ok: false as const, error: errText(e, "Failed") }));
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(hide ? "Hidden from the public" : "Shown again");
    onChanged();
  }
  return (
    <li className={`py-3 ${r.status === "hidden" ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {r.author.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.author.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs">{r.author.name.slice(0, 1)}</span>
        )}
        <span className="font-medium">{r.author.name}</span>
        {r.rating != null && <Stars value={r.rating} />}
        <span className="text-xs text-muted-foreground">{when(r.createdAt)}</span>
        {r.status === "hidden" && (
          <span className="rounded-full border border-border px-2 text-[0.7rem] uppercase tracking-wider text-muted-foreground">
            hidden{r.hiddenReason ? `: ${r.hiddenReason}` : ""}
          </span>
        )}
        {canModerate && (
          <button type="button" disabled={busy} onClick={toggleHidden} className="ml-auto text-xs underline underline-offset-4 disabled:opacity-50">
            {r.status === "hidden" ? "Show" : "Hide"}
          </button>
        )}
      </div>
      {r.body && <p className="mt-1.5 whitespace-pre-line">{r.body}</p>}
    </li>
  );
}

function WriteBox({ target, mine, onSaved, compact }: { target: ReviewTarget; mine: Review | null; onSaved: () => void; compact: boolean }) {
  const [rating, setRating] = React.useState<number | null>(mine?.rating ?? null);
  const [body, setBody] = React.useState(mine?.body ?? "");
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(!mine);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (rating == null && !body.trim()) return void toast.error("Give it some stars or a few words.");
    setBusy(true);
    const res = await saveReviewAction({ target, rating, body: body.trim() || null }).catch((x: unknown) => ({ ok: false as const, error: errText(x, "Could not save.") }));
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(mine ? "Review updated" : "Thank you for the review");
    setEditing(false);
    onSaved();
  }

  async function remove() {
    if (!mine || !window.confirm("Delete your review?")) return;
    setBusy(true);
    const res = await deleteOwnReviewAction(mine.id).catch((x: unknown) => ({ ok: false as const, error: errText(x, "Could not delete.") }));
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    onSaved();
  }

  if (mine && !editing) {
    return (
      <div className="rounded-md border border-border p-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium">Your review</span>
          {mine.rating != null && <Stars value={mine.rating} />}
          {mine.status === "hidden" && <span className="text-xs text-muted-foreground">(hidden by the editors)</span>}
          <button type="button" onClick={() => setEditing(true)} className="ml-auto underline underline-offset-4">
            Edit
          </button>
          <button type="button" disabled={busy} onClick={remove} className="text-muted-foreground underline underline-offset-4">
            Delete
          </button>
        </div>
        {mine.body && <p className="mt-1.5 whitespace-pre-line">{mine.body}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>{mine ? "Edit your review" : "Your review"}</span>
        <span role="radiogroup" aria-label="Stars (optional)" className="flex">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => setRating(rating === n ? null : n)}
              className={`px-0.5 text-lg leading-none ${rating != null && n <= rating ? "text-amber-600" : "text-muted-foreground/40"}`}
            >
              ★
            </button>
          ))}
        </span>
        <span className="text-xs text-muted-foreground">optional</span>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={compact ? 2 : 3}
        maxLength={4000}
        placeholder="What was it like?"
        className="w-full rounded-md border border-border bg-background p-2 text-sm"
      />
      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {busy ? "Saving…" : mine ? "Save" : "Post review"}
        </button>
        {mine && (
          <button type="button" onClick={() => setEditing(false)} className="text-sm underline underline-offset-4">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function FollowPrompt({ onFollowed }: { onFollowed: () => void }) {
  const [busy, setBusy] = React.useState(false);
  async function follow() {
    setBusy(true);
    const res = await fetch("/api/center/follow", { method: "POST" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return void toast.error("Could not follow just now.");
    toast.success("You follow us now");
    onFollowed();
  }
  return (
    <p className="text-sm text-muted-foreground">
      Follow us to leave a review.{" "}
      <button type="button" disabled={busy} onClick={follow} className="font-medium text-foreground underline underline-offset-4 disabled:opacity-50">
        {busy ? "Following…" : "Follow"}
      </button>
    </p>
  );
}

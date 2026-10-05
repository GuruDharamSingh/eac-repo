"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createQuestionInterpretationAction } from "@/app/hub/studio/interpret/actions";

/**
 * Your answer to a deck question, in your own words. On submit it is queued
 * for the reasoning worker and you land on its page, which fills in as the
 * chains and the passages the AI looked at arrive.
 */
export function ExplainThinkingForm({ questionId, maxLength }: { questionId: string; maxLength: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");

  const submit = () =>
    startTransition(async () => {
      const r = await createQuestionInterpretationAction({ questionId, body });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      router.push(`/hub/studio/interpret/${r.id}`);
    });

  return (
    <form
      className="mt-4 rounded-2xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="block text-sm font-medium" htmlFor="thinking">
        Your answer
      </label>
      <textarea
        id="thinking"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={9}
        maxLength={maxLength}
        placeholder="What you would tell a client, or what you think would happen and why. Each sentence can be explained separately."
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-base leading-relaxed"
      />
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>The phone keyboard&apos;s microphone works here.</span>
        <span className="tabular-nums">{body.length.toLocaleString()}</span>
      </div>

      <button
        type="submit"
        disabled={pending || body.trim().length === 0}
        className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Saving…" : "Explain my thinking"}
      </button>
    </form>
  );
}

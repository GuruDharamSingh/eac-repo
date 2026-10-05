"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createInterpretationAction } from "@/app/hub/studio/interpret/actions";

/**
 * Write an interpretation of one of your charts. On submit it is queued for
 * the worker and you land on its page, which fills in as chains arrive.
 */
export function NewInterpretationForm({ charts, maxLength }: { charts: { id: string; name: string; birthDate: string }[]; maxLength: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [chartId, setChartId] = useState(charts[0]?.id ?? "");
  const [body, setBody] = useState("");

  const submit = () =>
    startTransition(async () => {
      const r = await createInterpretationAction({ chartId, body });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      router.push(`/hub/studio/interpret/${r.id}`);
    });

  return (
    <form
      className="rounded-2xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="block text-sm font-medium" htmlFor="chart">
        Chart
      </label>
      <select
        id="chart"
        value={chartId}
        onChange={(e) => setChartId(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      >
        {charts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} · {c.birthDate}
          </option>
        ))}
      </select>

      <label className="mt-4 block text-sm font-medium" htmlFor="interpretation">
        Your interpretation
      </label>
      <textarea
        id="interpretation"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={9}
        maxLength={maxLength}
        placeholder="Write it as you would for a client. Each sentence can be explained separately."
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-base leading-relaxed"
      />
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>The phone keyboard's microphone works here.</span>
        <span className="tabular-nums">{body.length.toLocaleString()}</span>
      </div>

      <button
        type="submit"
        disabled={pending || !chartId || body.trim().length === 0}
        className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Saving…" : "Explain my reasoning"}
      </button>
    </form>
  );
}

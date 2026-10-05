import Link from "next/link";
import type { Metadata } from "next";
import { INTERPRETATION_MAX, listInterpretations } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";
import { listCharts } from "@/lib/charts";
import { NewInterpretationForm } from "@/components/studio/new-interpretation-form";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reasoning · Studio" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  queued: "waiting for the worker",
  running: "generating",
  ready: "ready",
  failed: "failed",
};

/**
 * The reasoning explorer's front page: write an interpretation of one of your
 * charts, and see the ones already written. The worker (Claude on the owner's
 * subscription) proposes chains of reasoning that would lead to each.
 */
export default async function InterpretPage() {
  const viewer = await requireStudioReviewer("/hub/studio/interpret");
  const [items, charts] = await Promise.all([
    listInterpretations(viewer.userId),
    listCharts({ kind: "user", userId: viewer.userId }),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/hub/studio" className="text-sm text-muted-foreground hover:text-primary">
          ← Studio
        </Link>
        <span className="text-xs uppercase tracking-[0.2em] text-gold">Reasoning</span>
      </div>

      <h1 className="mt-4 text-2xl font-semibold">Why would you say that?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Write your interpretation of a chart. The AI proposes several chains of reasoning that could lead to what you wrote — the chart factors it
        noticed, the passages from the library it leans on, and each inference — and every step shows which earlier steps it rests on. Mark each
        step right or wrong, comment, and pick the chain closest to how you actually think.
      </p>

      <section className="mt-6">
        {charts.length ? (
          <NewInterpretationForm charts={charts.map((c) => ({ id: c.id, name: c.name, birthDate: c.birthDate }))} maxLength={INTERPRETATION_MAX} />
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            You have no saved charts yet.{" "}
            <Link href="/calculate" className="text-primary">
              Calculate and save one
            </Link>{" "}
            first.
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your interpretations</h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((it) => (
              <li key={it.id}>
                <Link href={`/hub/studio/interpret/${it.id}`} className="block rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/60">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{it.chartName ?? (it.questionPrompt ? `Question: ${it.questionPrompt}` : "Question")}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-xs",
                        it.status === "ready" ? "border-primary/50 text-primary" : it.status === "failed" ? "border-destructive/60 text-destructive" : "border-border text-muted-foreground",
                      )}
                    >
                      {STATUS_LABEL[it.status] ?? it.status}
                      {it.chains ? ` · ${it.chains} chain${it.chains === 1 ? "" : "s"}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{it.excerpt}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(it.createdAt).toLocaleDateString()}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

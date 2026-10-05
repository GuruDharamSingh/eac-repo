import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CHAIN_VERDICTS, getInterpretation, REASONING_TEXT_MAX, REF_VERDICTS, STEP_KINDS, STEP_VERDICTS } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";
import { ReasoningExplorer } from "@/components/studio/reasoning-explorer";

export const metadata: Metadata = { title: "Reasoning · Studio" };
export const dynamic = "force-dynamic";

/**
 * One interpretation (of a chart, or the owner's answer to a deck question)
 * with the chains of reasoning proposed for it, the passages the AI looked
 * at, and the owner's verdicts and marks on them.
 */
export default async function InterpretationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireStudioReviewer(`/hub/studio/interpret/${id}`);
  const detail = await getInterpretation(id, viewer.userId);
  if (!detail) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/hub/studio/interpret" className="text-sm text-muted-foreground hover:text-primary">
          ← Interpretations
        </Link>
        <span className="text-xs uppercase tracking-[0.2em] text-gold">Reasoning</span>
      </div>
      <ReasoningExplorer
        detail={detail}
        chainVerdicts={[...CHAIN_VERDICTS]}
        stepVerdicts={[...STEP_VERDICTS]}
        stepKinds={[...STEP_KINDS]}
        refVerdicts={[...REF_VERDICTS]}
        textMax={REASONING_TEXT_MAX}
      />
    </div>
  );
}

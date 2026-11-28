import type { Metadata } from "next";
import { StepPage, stepMetadata } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";
import { settle } from "@/lib/settle";
import { getStepForm } from "@/lib/step-form";
import { StepActionForm } from "@/components/StepActionForm";

type Props = { params: Promise<{ course: string; step: string }>; searchParams: Promise<{ notice?: string; error?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  return stepMetadata(connectors, p.course, p.step);
}

export default async function Page({ params, searchParams }: Props) {
  const p = await params;
  const node = settle(await StepPage({ c: connectors, courseSlug: p.course, stepSlug: p.step, q: await searchParams }));
  // A task step whose action has a declared form is done right here, in the same form the dock uses.
  const form = await getStepForm(p.course, p.step);
  return (
    <>
      {node}
      {form && (
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 1rem 3rem" }}>
          <StepActionForm entry={form.entry} title={form.title} loaded={form.loaded} confirm={form.confirm} />
        </section>
      )}
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { DeclaredFormStep } from "@elkdonis/dock";
import type { LoadedForm } from "@elkdonis/actions";
import { runDeclaredForm } from "@/lib/dock-actions";

/** A lesson step's action form: the dock's declared form, run through Sophia's own server action. */
export function StepActionForm({ entry, title, loaded, confirm }: { entry: string; title: string; loaded: LoadedForm; confirm: React.ComponentProps<typeof DeclaredFormStep>["confirm"] }) {
  const router = useRouter();
  return (
    <DeclaredFormStep
      loaded={loaded}
      confirm={confirm}
      title={title}
      run={(values, ctx) => runDeclaredForm(entry, values, { subject: ctx.subject, confirmed: true })}
      onDone={() => router.refresh()}
    />
  );
}

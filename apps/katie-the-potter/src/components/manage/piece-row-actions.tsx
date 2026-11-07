"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setShownAsAction, retireSamplesAction, type ShownAs } from "@/lib/manage-actions";
import { useToast } from "@elkdonis/cms-ui/manage/client";

/**
 * "Shown as" for one piece: For sale · Portfolio only · Hidden. The action
 * re-checks everything; this only calls it and shows what it answered.
 */
export function ShownAsControl({ id, current, disabled }: { id: string; current: ShownAs | null; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toast = useToast();

  const set = (mode: ShownAs) =>
    start(async () => {
      const r = await setShownAsAction(id, mode).catch(() => null);
      toast(r);
      if (r?.ok) router.refresh();
    });

  const options: Array<[ShownAs, string]> = [
    ["sale", "For sale"],
    ["portfolio", "Picture only"],
    ["hidden", "Hidden"],
  ];
  return (
    <div className="ktp-m-seg-wrap">
      <div className="ktp-m-seg" role="group" aria-label="Shown as">
        {options.map(([mode, label]) => (
          <button key={mode} type="button" aria-pressed={current === mode} disabled={pending || disabled} onClick={() => set(mode)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** One-click "Retire all samples", behind a confirm. Owner only on the server too. */
export function RetireSamples({ count }: { count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toast = useToast();
  if (count === 0) return null;
  return (
    <div className="ktp-m-retire">
      <button
        type="button"
        className="ktp-btn ktp-btn--ghost"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Retire ${count} sample ${count === 1 ? "piece" : "pieces"}? They are archived and leave the public site. Pieces with an order behind them are left alone.`)) return;
          start(async () => {
            const r = await retireSamplesAction().catch(() => null);
            toast(r);
            if (r?.ok) router.refresh();
          });
        }}
      >
        {pending ? "Retiring…" : `Retire all ${count} sample${count === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}

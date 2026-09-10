"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createLotAction } from "../actions";

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-[2px] focus:ring-ring/50";
const labelCls = "mb-1 block text-sm font-medium";

function localInputValue(d: Date): string {
  // datetime-local wants local time without zone, to the minute.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LotForm({
  artworkId,
  listPrice,
  currency,
}: {
  artworkId: string;
  /** Major units, to seed a sensible starting bid. */
  listPrice: number;
  currency: string;
}) {
  const router = useRouter();
  const [startNow, setStartNow] = React.useState(true);
  const [startAt, setStartAt] = React.useState(localInputValue(new Date(Date.now() + 3600_000)));
  const [endAt, setEndAt] = React.useState(localInputValue(new Date(Date.now() + 7 * 86400_000)));
  const [startingBid, setStartingBid] = React.useState(
    listPrice > 0 ? String(Math.max(1, Math.round(listPrice / 2))) : ""
  );
  const [reserve, setReserve] = React.useState("");
  const [increment, setIncrement] = React.useState(
    listPrice >= 1000 ? "50" : listPrice >= 200 ? "25" : "10"
  );
  const [antiSnipe, setAntiSnipe] = React.useState("5");
  const [pending, setPending] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!(Number(startingBid) > 0)) return toast.error("Set a starting bid.");
    setPending(true);
    try {
      const res = await createLotAction({
        artworkId,
        startAt: startNow ? null : new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        startingBid: Number(startingBid),
        reserve: reserve.trim() ? Number(reserve) : null,
        bidIncrement: increment.trim() ? Number(increment) : null,
        antiSnipeMinutes: antiSnipe.trim() ? Number(antiSnipe) : null,
      });
      if (!res.ok || !res.lotId) return toast.error(res.error ?? "Could not start the auction.");
      toast.success("The auction is up.");
      router.push(`/lots/${res.lotId}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="startingBid">
            Starting bid ({currency})
          </label>
          <input
            id="startingBid"
            type="number"
            min="1"
            step="1"
            className={inputCls}
            value={startingBid}
            onChange={(e) => setStartingBid(e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="reserve">
            Reserve ({currency}, optional)
          </label>
          <input
            id="reserve"
            type="number"
            min="0"
            step="1"
            className={inputCls}
            value={reserve}
            onChange={(e) => setReserve(e.target.value)}
            placeholder="Lowest price you will accept"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            If bidding ends below the reserve the piece is not sold.
          </p>
        </div>
        <div>
          <label className={labelCls} htmlFor="increment">
            Bid increment ({currency})
          </label>
          <input
            id="increment"
            type="number"
            min="1"
            step="1"
            className={inputCls}
            value={increment}
            onChange={(e) => setIncrement(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="antiSnipe">
            Anti-snipe (minutes)
          </label>
          <input
            id="antiSnipe"
            type="number"
            min="0"
            step="1"
            className={inputCls}
            value={antiSnipe}
            onChange={(e) => setAntiSnipe(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            A bid in the last N minutes extends the auction by N minutes.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Starts</label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={startNow}
              onChange={(e) => setStartNow(e.target.checked)}
            />
            As soon as it is listed
          </label>
          {!startNow && (
            <input
              type="datetime-local"
              className={`${inputCls} mt-2`}
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          )}
        </div>
        <div>
          <label className={labelCls} htmlFor="endAt">
            Ends
          </label>
          <input
            id="endAt"
            type="datetime-local"
            className={inputCls}
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            At least an hour, at most 60 days. Buy-now is switched off while the
            auction runs.
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Starting…" : "Start the auction"}
      </button>
    </form>
  );
}

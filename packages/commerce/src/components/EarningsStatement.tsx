import * as React from "react";
import { formatMoney } from "../money";
import type { Currency } from "../types";
import { cn } from "./cn";

/**
 * What a person is owed, what has been paid, and why — the statement side of
 * the manual payout tier.
 *
 * Presentation only: it takes rows someone else read with
 * `getEarningsStatement`. That keeps it usable on the artist's own studio
 * page, on an org hub and in an admin console, none of which agree about how
 * they fetch data.
 *
 * The point of showing the line detail rather than a single balance is that a
 * person being paid by hand has no other way to check the arithmetic. A number
 * with no workings behind it asks them to take the collective's word for it.
 */

export interface EarningsStatementLine {
  entryId: string;
  entryType: "accrual" | "payout" | "adjustment" | "refund" | "release";
  amountMinor: number;
  currency: string;
  createdAt: string;
  held: boolean;
  holdReason: string | null;
  note: string | null;
  orderNumber: string | null;
  description: string | null;
  payoutMethod: string | null;
  payoutReference: string | null;
}

export interface EarningsStatementProps {
  lines: EarningsStatementLine[];
  payableMinor: number;
  heldMinor: number;
  currency?: Currency;
  /** Shown under the payable figure — e.g. how this person gets paid. */
  payoutNote?: React.ReactNode;
  emptyLabel?: string;
  className?: string;
}

const HOLD_COPY: Record<string, string> = {
  no_payout_account: "waiting on your payout details",
  below_threshold: "under the payout minimum",
  org_unowned: "waiting on the organisation",
  dispute_window: "clearing",
};

const RAIL_COPY: Record<string, string> = {
  etransfer: "Interac e-Transfer",
  stripe: "Stripe",
  manual: "arranged directly",
};

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function EarningsStatement({
  lines,
  payableMinor,
  heldMinor,
  currency = "CAD",
  payoutNote,
  emptyLabel = "Nothing yet. When something of yours sells, it shows up here straight away.",
  className,
}: EarningsStatementProps) {
  const money = lines.filter((l) => l.entryType !== "release");

  return (
    <section className={cn("eac-commerce eac-earn", className)}>
      <div className="eac-earn-totals">
        <div className="eac-earn-total">
          <span className="eac-earn-total-label">Owed to you now</span>
          <strong className="eac-earn-total-figure">{formatMoney(payableMinor, currency)}</strong>
          {payoutNote && <span className="eac-earn-total-note">{payoutNote}</span>}
        </div>
        {heldMinor > 0 && (
          <div className="eac-earn-total eac-earn-total--held">
            <span className="eac-earn-total-label">Not payable yet</span>
            <strong className="eac-earn-total-figure">{formatMoney(heldMinor, currency)}</strong>
            <span className="eac-earn-total-note">Shown line by line below.</span>
          </div>
        )}
      </div>

      {money.length === 0 ? (
        <p className="eac-earn-empty">{emptyLabel}</p>
      ) : (
        <ol className="eac-earn-list">
          {money.map((l) => {
            const isPayout = l.entryType === "payout";
            const title = isPayout
              ? `Paid out${l.payoutMethod ? ` by ${RAIL_COPY[l.payoutMethod] ?? l.payoutMethod}` : ""}`
              : l.description ?? l.note ?? "Sale";
            return (
              <li key={l.entryId} className="eac-earn-row">
                <div className="eac-earn-row-main">
                  <span className="eac-earn-row-title">{title}</span>
                  <span className="eac-earn-row-meta">
                    {when(l.createdAt)}
                    {l.orderNumber ? ` · order ${l.orderNumber}` : ""}
                    {isPayout && l.payoutReference ? ` · ref ${l.payoutReference}` : ""}
                  </span>
                  {l.held && (
                    <span className="eac-earn-flag">
                      {HOLD_COPY[l.holdReason ?? ""] ?? "on hold"}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "eac-earn-row-amount",
                    l.amountMinor < 0 && "eac-earn-row-amount--out",
                    l.held && "eac-earn-row-amount--held"
                  )}
                >
                  {formatMoney(l.amountMinor, currency)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

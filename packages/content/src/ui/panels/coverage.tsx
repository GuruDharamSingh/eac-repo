"use client";

import * as React from "react";
import { fmtDay, type ContentCoveragePanel, type ContentIdentity } from "../../model";
import { IdentityMark, NextChip, OutletIcon, StateMark } from "../atoms";

/** "Coverage by identity": one row per identity, one column per outlet. */
export function CoveragePanel({ data, identities, timeZone }: { data: ContentCoveragePanel; identities: ContentIdentity[]; timeZone: string }) {
  const byId = new Map(identities.map((i) => [i.id, i]));
  return (
    <table className="chn-cov">
      <thead>
        <tr>
          <th scope="col">
            <span className="chn-sr">Identity</span>
          </th>
          {data.columns.map((c) => (
            <th key={c.id} scope="col" title={c.label}>
              <OutletIcon outlet={c.outlet} size={14} title={c.label} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row) => {
          const i = byId.get(row.identityId);
          if (!i) return null;
          return (
            <tr key={i.id}>
              <th scope="row">
                <IdentityMark initials={i.initials} kind={i.kind} size={18} /> {i.kind === "user" ? "You" : i.shortName}
              </th>
              {data.columns.map((c) => {
                const cell = row.cells[c.id];
                return (
                  <td key={c.id}>
                    {cell && cell.state !== "empty" ? (
                      <span className="chn-cov-cell">
                        <StateMark state={cell.state} />
                        <small>{fmtDay(cell.at, timeZone)}</small>
                      </span>
                    ) : cell?.suggestion ? (
                      <NextChip suggestion={cell.suggestion} compact />
                    ) : (
                      <span className="chn-none" aria-label="Not yet">
                        —
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

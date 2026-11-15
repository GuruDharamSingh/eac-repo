import * as React from "react";
import { OutletIcon } from "@elkdonis/content/ui";
import type { ContentOutlet } from "@elkdonis/content/model";
import type { ChannelHubData, HubDot } from "./data";

/**
 * The Channel hub card's face (2026-11-15): a mini matrix of state dots (the top pieces by the Board's outlets)
 * and one line, "3 waiting · 2 did not go". Plain markup, no hooks, no next/*; the host puts it in a SurfaceCard's
 * `preview`. Flat: thin lines, no shadow.
 */
const WORD: Record<HubDot, string> = { failed: "did not go", out: "out", scheduled: "scheduled", planned: "planned", draft: "draft", none: "not there" };

export function dotLabel(d: HubDot): string {
  return WORD[d];
}

export function ChannelHubFace({ data }: { data: ChannelHubData }) {
  const { matrix, counts } = data;
  const line = [`${counts.waiting} waiting`, `${counts.failed} did not go`].join(" · ");
  return (
    <div className="chp chp-face">
      {matrix.rows.length === 0 ? (
        <p className="chp-fine">No pieces yet.</p>
      ) : (
        <table className="chp-mini" role="img" aria-label={`Pieces by outlet. ${line}.`}>
          <thead>
            <tr>
              <th scope="col" />
              {matrix.cols.map((c) => (
                <th key={c.id} scope="col" title={c.title} aria-label={c.title}>
                  <OutletIcon outlet={c.outlet as ContentOutlet} size={12} title={c.title} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.title}</th>
                {r.cells.map((d, i) => (
                  <td key={matrix.cols[i].id}>
                    <span className="chp-dot" data-state={d} title={`${matrix.cols[i].label}: ${WORD[d]}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="chp-line" data-alert={counts.failed > 0 ? "1" : undefined}>
        {line}
      </p>
    </div>
  );
}

import type { CSSProperties } from "react";

export interface ArrivalsTableRow {
  id: string;
  email: string;
  displayName: string | null;
  path: string | null;
  fromHost: string | null;
  fromOrgName: string | null;
  arrivedAt: Date | string;
  /** Current role in the org; 'viewer' is a follower. */
  role: string | null;
}

export interface ArrivalsTableProps {
  arrivals: ArrivalsTableRow[];
  heading?: string;
}

/**
 * People who arrived on this org's site signed in through the network SSO
 * handoff (network_arrivals, via listOrgArrivals in @elkdonis/services):
 * who, from where, to which page, when, and whether they now follow or
 * belong. Server-renderable; inline styles on --eac-control-* tokens so it
 * sits in any app's manage page. Returns null when there are none.
 */
export function ArrivalsTable({ arrivals, heading = "Arrived from the network" }: ArrivalsTableProps) {
  if (arrivals.length === 0) return null;
  return (
    <section style={{ marginTop: "3rem" }}>
      <h2 style={{ fontSize: "1.4rem", margin: 0 }}>{heading}</h2>
      <p style={{ margin: "0.3rem 0 1rem", color: "var(--eac-control-muted, #666)", fontSize: "0.9rem" }}>
        Signed-in people who came here from another site in the network, or arrived for the first time.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: "36rem", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--eac-control-muted, #666)" }}>
              <th style={th}>Person</th>
              <th style={th}>Came from</th>
              <th style={th}>Page</th>
              <th style={th}>When</th>
              <th style={th}>Now</th>
            </tr>
          </thead>
          <tbody>
            {arrivals.map((a) => (
              <tr key={a.id}>
                <td style={td}>
                  {a.displayName || a.email}
                  {a.displayName ? (
                    <div style={{ color: "var(--eac-control-muted, #666)", fontSize: "0.8rem" }}>{a.email}</div>
                  ) : null}
                </td>
                <td style={td}>{a.fromOrgName ?? a.fromHost ?? "Direct"}</td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: "0.8rem" }}>{a.path ?? "/"}</td>
                <td style={td}>{formatWhen(a.arrivedAt)}</td>
                <td style={td}>{a.role === "viewer" ? "Follows" : a.role ? `Member (${a.role})` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatWhen(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" });
}

const th: CSSProperties = {
  padding: "0 1rem 0.5rem 0",
  fontWeight: 500,
  borderBottom: "1px solid var(--eac-control-line, #d4d4d4)",
};

const td: CSSProperties = {
  padding: "0.6rem 1rem 0.6rem 0",
  borderBottom: "1px solid var(--eac-control-line, #e5e5e5)",
  verticalAlign: "top",
};

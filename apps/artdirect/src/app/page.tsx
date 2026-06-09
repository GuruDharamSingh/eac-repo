import Link from "next/link";
import { listDossiers, listDirectoryFacets } from "@/lib/oad";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ region?: string }> };

export default async function ArtDirectHome({ searchParams }: Props) {
  const { region } = await searchParams;
  const [dossiers, facets] = await Promise.all([listDossiers({ region }), listDirectoryFacets()]);

  const chip = (active: boolean): React.CSSProperties => ({
    display: "inline-block",
    padding: "0.3rem 0.7rem",
    border: "1px solid #000",
    background: active ? "#8c3b3b" : "#1e2220",
    color: "#f7f1e3",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    textDecoration: "none",
  });

  return (
    <main style={{ minHeight: "100vh", background: "#121413", color: "#f7f1e3" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "3rem 1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: "#8c3b3b", margin: 0 }}>
              ArtDirect · an Elkdonis commons
            </p>
            <h1 style={{ fontSize: "2.6rem", margin: "0.5rem 0 0.25rem", letterSpacing: 1 }}>THE ARTIST DIRECTORY</h1>
            <p style={{ maxWidth: 640, color: "#cbbf9d", lineHeight: 1.6 }}>
              An open, community-built record of artists — a wiki and classifieds for the field.
              Anyone can open a file on an artist they know; artists can claim and verify their own;
              the network vouches. {dossiers.length} on record{region ? ` in ${region}` : ""}.
            </p>
          </div>
          <Link
            href="/new"
            style={{ ...chip(true), padding: "0.65rem 1.15rem", fontWeight: 700, whiteSpace: "nowrap" }}
          >
            + Open a file
          </Link>
        </div>

        <form method="get" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1.75rem", alignItems: "center" }}>
          <input
            name="region"
            defaultValue={region ?? ""}
            list="ad-filter-regions"
            autoComplete="off"
            placeholder="Filter by region…"
            style={{ padding: "0.45rem 0.7rem", border: "1px solid #000", background: "#fff", color: "#1a1a1a", fontFamily: "inherit", fontSize: 14, minWidth: 220 }}
          />
          <datalist id="ad-filter-regions">
            {facets.regions.map((r) => <option key={r} value={r} />)}
          </datalist>
          <button type="submit" style={chip(true)}>Filter</button>
          {region && <Link href="/" style={chip(false)}>Clear</Link>}
        </form>

        {dossiers.length === 0 ? (
          <p style={{ marginTop: "2rem", color: "#cbbf9d" }}>
            No dossiers on file yet. <Link href="/new" style={{ color: "#e08a8a" }}>Open the first file →</Link>
          </p>
        ) : (
          <div
            style={{
              marginTop: "2rem",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "1rem",
            }}
          >
            {dossiers.map((d) => (
              <Link
                key={d.slug}
                href={`/${d.slug}`}
                style={{ display: "block", padding: "1rem", background: "#1e2220", border: "1px solid #000", color: "#f7f1e3", textDecoration: "none" }}
              >
                <div style={{ display: "flex", gap: "0.9rem", alignItems: "center" }}>
                  <img
                    src={d.portrait_url || "https://placehold.co/64x80/e4cc9a/1a1a1a?text=?"}
                    alt={d.name}
                    width={56}
                    height={70}
                    style={{ objectFit: "cover", border: "1px solid #000", flexShrink: 0 }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: "block", letterSpacing: 1 }}>{d.name}</strong>
                    {d.occupation && <span style={{ fontSize: 13, color: "#cbbf9d" }}>{d.occupation}</span>}
                    {(d.region || d.location) && (
                      <span style={{ display: "block", fontSize: 12, color: "#9a8f70" }}>{d.region || d.location}</span>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "space-between", fontSize: 11, letterSpacing: 1 }}>
                  <span style={{ color: d.verified ? "#5a8c5a" : "#8c3b3b" }}>
                    {d.verified ? "● VERIFIED" : `● ${d.claim_status.toUpperCase()}`}
                  </span>
                  {d.vouch_count > 0 && <span style={{ color: "#9a8f70" }}>{d.vouch_count} vouch{d.vouch_count === 1 ? "" : "es"}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

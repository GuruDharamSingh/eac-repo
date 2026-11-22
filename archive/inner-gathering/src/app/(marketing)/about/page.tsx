import { db } from "@elkdonis/db";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";
import { AboutLivingDoc, type AboutDocument } from "@/components/about-living-doc";

// The About page is a living document kept in Nextcloud and embedded here.
// The previous hand-authored version is preserved (unserved) at
// (marketing)/about/_legacy/about-legacy.tsx.

const SITE_CONFIG_ORG = "elkdonis";
const ABOUT_KEY = "about_document";

export const metadata = {
  title: "About | Elkdonis Arts Collective",
  description:
    "About the Elkdonis Arts Collective — an international anarchist arts and education collective.",
};

async function getAboutDocument(): Promise<AboutDocument | null> {
  try {
    const [row] = await db`
      SELECT value FROM site_config
      WHERE org_id = ${SITE_CONFIG_ORG} AND key = ${ABOUT_KEY}
      LIMIT 1
    `;
    return (row?.value as AboutDocument) ?? null;
  } catch {
    return null;
  }
}

export default async function AboutPage() {
  const session = await getServerSession();
  const userId = session?.user?.id ?? null;
  const [document, userIsAdmin] = await Promise.all([
    getAboutDocument(),
    userId ? isAdmin(userId) : Promise.resolve(false),
  ]);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "clamp(1.5rem, 5vw, 3.5rem) 1rem" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <p
          style={{
            margin: 0,
            fontFamily: "'Cinzel', serif",
            fontSize: "0.7rem",
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "var(--ig-gold, #8f763c)",
          }}
        >
          The Collective
        </p>
        <h1 style={{ margin: "0.25rem 0 0", fontFamily: "'Cinzel', serif", fontSize: "clamp(1.8rem, 5vw, 2.8rem)" }}>
          About
        </h1>
      </header>

      <AboutLivingDoc document={document} isAdmin={userIsAdmin} />
    </div>
  );
}

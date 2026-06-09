import fs from "fs";
import path from "path";

type Manifest = {
  id: string;
  tokens?: string;
  cssOrder: string[];
};

function resolveTemplatesDir(): string {
  const candidates = [
    path.join(process.cwd(), "../../packages/silex-nextcloud-connector/src/templates"),
    path.join(process.cwd(), "packages/silex-nextcloud-connector/src/templates"),
    path.join(process.cwd(), "../../../../packages/silex-nextcloud-connector/src/templates"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`Silex templates dir not found. cwd=${process.cwd()}`);
}

let cached: string | null = null;

function buildDossierCss(): string {
  const root = resolveTemplatesDir();
  const templateDir = path.join(root, "dossier-classified");
  const manifest: Manifest = JSON.parse(
    fs.readFileSync(path.join(templateDir, "manifest.json"), "utf-8")
  );

  const parts: string[] = [];
  if (manifest.tokens) {
    const tokensPath = path.resolve(templateDir, manifest.tokens);
    parts.push(`/* ${path.relative(root, tokensPath)} */\n${fs.readFileSync(tokensPath, "utf-8")}`);
  }
  for (const rel of manifest.cssOrder) {
    parts.push(`/* dossier/${rel} */\n${fs.readFileSync(path.join(templateDir, rel), "utf-8")}`);
  }

  // Frame: the desk + centered manila file. The section CSS styles the contents;
  // these few rules provide the page surround the standalone sections expect.
  parts.push(`/* artdirect frame */
body { margin: 0; background: var(--eac-dos-bg-desk, #121413); }
.eac-dossier-file {
  max-width: 880px;
  margin: 2.5rem auto;
  padding: 2.5rem;
  background: var(--eac-dos-paper, #f7f1e3);
  border: 1px solid #000;
  box-shadow: 0 24px 60px rgba(0,0,0,.45);
}
@media (max-width: 600px) { .eac-dossier-file { margin: 0; padding: 1.5rem; } }`);

  return parts.join("\n\n");
}

export async function GET() {
  if (cached === null) cached = buildDossierCss();
  return new Response(cached, {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

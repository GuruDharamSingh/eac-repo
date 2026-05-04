import fs from "fs";
import path from "path";

type Manifest = {
  id: string;
  tokens?: string;
  cssOrder: string[];
};

function resolveTemplatesDir(): string {
  const candidates = [
    path.join(
      process.cwd(),
      "../../packages/silex-nextcloud-connector/src/templates"
    ),
    path.join(
      process.cwd(),
      "packages/silex-nextcloud-connector/src/templates"
    ),
    path.join(
      process.cwd(),
      "../../../../packages/silex-nextcloud-connector/src/templates"
    ),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(
    `Silex templates dir not found. cwd=${process.cwd()}`
  );
}

let cached: string | null = null;

function buildWorkshopCss(): string {
  const root = resolveTemplatesDir();
  const templateDir = path.join(root, "workshop");
  const manifest: Manifest = JSON.parse(
    fs.readFileSync(path.join(templateDir, "manifest.json"), "utf-8")
  );

  const parts: string[] = [];
  if (manifest.tokens) {
    const tokensPath = path.resolve(templateDir, manifest.tokens);
    parts.push(
      `/* ${path.relative(root, tokensPath)} */\n${fs.readFileSync(tokensPath, "utf-8")}`
    );
  }
  for (const rel of manifest.cssOrder) {
    parts.push(
      `/* workshop/${rel} */\n${fs.readFileSync(path.join(templateDir, rel), "utf-8")}`
    );
  }
  return parts.join("\n\n");
}

export async function GET() {
  if (cached === null) cached = buildWorkshopCss();
  return new Response(cached, {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

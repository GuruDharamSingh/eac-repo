/**
 * Write the factor registry and its vocabulary as JSON, for pipelines outside
 * this package. The bundled tagger prints the same with --registry.
 *
 *   docker run --rm --user 3003:3003 -e HOME=/tmp -v ~/eac:/app -w /app/packages/astro-corpus \
 *     eac-dev pnpm exec tsx scripts/export-registry.ts > factor-registry.json
 */

import { registryJson } from "../src/registry-json";

process.stdout.write(JSON.stringify(registryJson(), null, 2) + "\n");

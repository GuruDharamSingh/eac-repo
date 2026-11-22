// The block manifest as the tools read it: a checked-in, generated file (./blocks.generated.ts), no database.
import { BLOCK_MANIFEST } from './blocks.generated';
import type { ManifestBlock, ManifestFile } from './types';

export type { ManifestBlock, ManifestFile, ManifestSetting, ManifestPart, BlockRead } from './types';
export { buildManifest, readPlain, FIELD_PATTERN, RECORD_PATTERN } from './build';

export interface Manifest {
  file: ManifestFile;
  byId: Record<string, ManifestBlock>;
  /** The blocks an assistant may see (agent.read), in id order. */
  visible: ManifestBlock[];
}

let cached: Manifest | null = null;

export function manifest(): Manifest {
  if (!cached) {
    const file = BLOCK_MANIFEST as ManifestFile;
    const byId: Record<string, ManifestBlock> = {};
    for (const b of file.blocks) byId[b.id] = b;
    cached = { file, byId, visible: file.blocks.filter((b) => b.agent.read) };
  }
  return cached;
}

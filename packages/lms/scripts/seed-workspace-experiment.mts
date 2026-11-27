// ============================================================================
// Seed a small PRIVATE experiment in org `sunjay` for the experiment preset, with the TEST accounts only
// (guide bb77984c..., participants e6bf54d9... and 7a75e3ce...). Engine functions only. Safe to re-run.
//   cd ~/eac && sudo -n docker compose run --rm --no-deps sophia sh -c "cd /app/packages/lms && npx tsx scripts/seed-workspace-experiment.mts"
// Remove with the workspace's Archive (or:  UPDATE lms_courses SET archived_at = NOW() WHERE slug = 'breath-attention-experiment';)
// ============================================================================
import { buildExperiment } from './experiment-fixture.mts';

const f = await buildExperiment({ title: 'Breath and attention experiment', slug: 'breath-and-attention-experiment' });
console.log(JSON.stringify(f, null, 1));
process.exit(0);

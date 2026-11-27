// Atlas area file (2026-11-16, lane rails): the dock's own bookkeeping (lms_dock_state): which course the person
// follows, where to come back to, which step was just finished. Not something a person does on the network, so
// class 'internal' (not a rail step). Conventions: atlas/JOURNAL.md.
import type { Area, Capability } from '../types';

const A = 'apps/arts-collective/src/lib/actions/dock-actions.ts';
// The market's copy of the same four actions (2026-11-24, dock mounted on art-auction).
const M = 'apps/art-auction/src/lib/dock-actions.ts';
const S = 'packages/actions/src/server/dock-state.ts';

const capabilities: Capability[] = [
  {
    id: 'dock-course-choose',
    area: 'dock.state',
    label: 'Choose a course in the dock',
    does: 'Keeps which course the person follows in the dock (lms_dock_state).',
    class: 'internal',
    actors: ['person'],
    scope: 'person',
    hosts: [{ key: `sa:${A}#dockChooseCourse` }, { key: `sa:${M}#dockChooseCourse` }, { key: `sql:${S}#dockChoose`, note: 'sql twin of dockChooseCourse (via dockChoose)' }],
    risk: ['none'],
    status: 'lms_dock_state has the course slug for the person',
    inputs: 'course slug',
    verified: '2026-11-16 read',
    added: '2026-11-16',
    updated: '2026-11-24',
  },
  {
    id: 'dock-step-leave-return',
    area: 'dock.state',
    label: 'Leave a step and come back to the trail',
    does: 'Keeps the step and the page to return to when the person goes to a page ("Take me there"), and reads it back on "Back to the trail".',
    class: 'internal',
    actors: ['person'],
    scope: 'person',
    hosts: [
      { key: `sa:${A}#dockDepart` },
      { key: `sa:${A}#dockReturn` },
      { key: `sa:${M}#dockDepart`, note: 'the market copy; its return path is a market path' },
      { key: `sa:${M}#dockReturn` },
      { key: `sql:${S}#dockDepart`, note: 'sql twin of dockDepart' },
    ],
    risk: ['none'],
    status: 'lms_dock_state has the step and return path for the person',
    inputs: 'course slug, step slug, return path',
    open: 'A return path is local to the host that stored it (isLocalPath): a trip from the market to a hub address comes back to a hub path. Market-local addresses avoid it.',
    verified: '2026-11-16 read',
    added: '2026-11-16',
    updated: '2026-11-24',
  },
  {
    id: 'dock-step-record',
    area: 'dock.state',
    label: 'Record a finished step in the dock',
    does: 'Writes the step the person is on, marks it done, and clears the "done" notice once it has been shown.',
    class: 'internal',
    actors: ['person'],
    scope: 'person',
    hosts: [
      { key: `sa:${A}#dockAckDone` },
      { key: `sa:${M}#dockAckDone` },
      { key: `sql:${S}#dockMarkDoneSeen`, note: 'sql twin of dockAckDone' },
      { key: `sql:${S}#dockMarkDone` },
      { key: `sql:${S}#writeDockStep` },
    ],
    risk: ['none'],
    status: 'lms_dock_state has the step marked done, then the notice cleared',
    inputs: 'course slug, step slug',
    verified: '2026-11-16 read',
    added: '2026-11-16',
    updated: '2026-11-24',
  },
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;

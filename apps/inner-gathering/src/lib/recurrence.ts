// Moved to @elkdonis/utils so amrit-canada (and the sites after it) share one
// implementation of the cycle math rather than forking it. Re-exported here so
// existing `@/lib/recurrence` imports keep working.
//
// Note the SQL twin in ./data.ts (CYCLE_CUTOFF_SQL) that must stay in sync —
// see the header comment in packages/utils/src/recurrence.ts.
export {
  recurrenceIntervalMs,
  lastOccurrenceEnd,
  nextOccurrence,
  isWithinCurrentCycle,
  type RecurrencePattern,
} from "@elkdonis/utils";

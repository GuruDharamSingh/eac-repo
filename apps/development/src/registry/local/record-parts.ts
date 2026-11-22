import type { Block } from "@elkdonis/blocks";
import { GATHERINGS, SERVICES, WRITINGS, attendanceOfGathering, payOfService, recordOfGathering, recordOfService, recordOfWriting } from "@/sample";
import { withSample } from "./util";

/**
 * @elkdonis/blocks record parts: record-header, record-body, record-facts are exported but in none of the
 * package's catalogue arrays, and checkout / rsvp are made per host with checkoutBlock / rsvpBlock. All are
 * importable from the package index as it is (no export line needed); the registry just never listed them.
 * Their resolver keys (RECORD_RESOLVED_KEYS) are filled from the shared sample world.
 */
export async function load(): Promise<Block<never>[]> {
  const m = await import("@elkdonis/blocks");
  const noop = async () => {};
  return [
    withSample(m.recordHeader, { rec: recordOfWriting(WRITINGS[0]) }),
    withSample(m.recordBody, { rec: recordOfWriting(WRITINGS[0]) }),
    withSample(m.recordFacts, { rec: recordOfGathering(GATHERINGS[0]) }),
    withSample(m.checkoutBlock({ action: noop }), { rec: recordOfService(SERVICES[1]), pay: payOfService(SERVICES[1]), recordRef: "sample" }),
    withSample(m.rsvpBlock({ action: noop }), { rec: recordOfGathering(GATHERINGS[0]), attendance: attendanceOfGathering(GATHERINGS[0]), recordRef: "sample" }),
  ];
}

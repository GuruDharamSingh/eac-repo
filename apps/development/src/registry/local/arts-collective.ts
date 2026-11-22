import type { Block } from "@elkdonis/blocks";
import { withSample } from "./util";

/** arts-collective: two blocks, both with their own sample(). */
export async function load(): Promise<Block<never>[]> {
  const [offering, people] = await Promise.all([
    import("../../../../arts-collective/src/blocks/ac-offering"),
    import("../../../../arts-collective/src/blocks/ac-people"),
  ]);
  return [offering.acOffering, people.acPeople].map((b) => withSample(b));
}

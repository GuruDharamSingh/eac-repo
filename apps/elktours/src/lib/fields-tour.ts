// The lens's doors for a tour's own words (a tour's page, the guide editing it in place). Server only.
// `record:tour:<id>:<field>` and `record:tourstop:<id>:line` are routed here by app/fields/actions.ts; everything about who may
// and what is stored is in lib/tour-fields.ts. The person comes from the session on every call, never from the request.

import { createFieldsActions, type FieldsRoute, type PerformResult } from "@elkdonis/house-editor/fields/server";
import { db } from "@elkdonis/db";
import { getViewer } from "@/lib/auth";
import { tourFieldsRegistry } from "@/lib/tour-fields-registry";
import * as tf from "@/lib/tour-fields";

/** The signed-in person as lib/tour-fields.ts wants them. */
async function actor(): Promise<tf.Actor | null> {
  const v = await getViewer().catch(() => null);
  return v ? { userId: v.userId, role: v.role } : null;
}

const done = (r: tf.WriteResult): PerformResult => (r.ok ? { ok: true } : { ok: false, error: r.error });

const tourRoute: FieldsRoute = {
  read: async (id) => tf.readTourFields(db, await actor(), id),
  save: async (id, values) => done(await tf.saveTourFields(db, await actor(), id, values)),
  restore: async (id, field) => done(await tf.putBackTourField(db, await actor(), id, field)),
};

const stopRoute: FieldsRoute = {
  read: async (id) => tf.readStopLine(db, await actor(), id),
  save: async (id, values) => done(await tf.saveStopLine(db, await actor(), id, values.line)),
  restore: async (id, field) => (field === "line" ? done(await tf.putBackStopLine(db, await actor(), id)) : { ok: false, error: "That is not an editable field." }),
};

export const TOUR_KINDS = new Set(["tour", "tourstop"]);

export const tourFields = createFieldsActions({
  registry: tourFieldsRegistry,
  // The lens at all: a signed-in owner or guide of this organisation. Which tour is decided again per tour, per call.
  authorize: async () => {
    const v = await getViewer().catch(() => null);
    if (!v) return "Sign in as the guide of this tour to change it.";
    return v.canEdit ? true : tf.NOT_YOURS;
  },
  routes: { tour: tourRoute, tourstop: stopRoute },
});

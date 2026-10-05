import type { Data } from "@puckeditor/core";
// The /rsc entry, as every route that renders Puck data: Next resolves the
// server Render only through it, and the bare specifier ships the editor.
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { PersonBlockContext } from "@elkdonis/blocks";
import { serverConfigFor, type PersonPageKind } from "@/lib/person-pages";

/**
 * A published person document (profile or featured), resolved against the
 * person's page as the viewer may see it and rendered. The caller supplies
 * the frame around it. Null when resolving fails, so the caller can fall back.
 */
export async function resolvePersonDoc(
  kind: PersonPageKind,
  data: unknown,
  context: PersonBlockContext
): Promise<Data | null> {
  try {
    return await resolveAllData(data as Data, serverConfigFor(kind), { person: context });
  } catch (err) {
    console.error(`[artdirect] resolving ${context.slug}/${kind}:`, err);
    return null;
  }
}

export function PersonDoc({ kind, data, context }: { kind: PersonPageKind; data: Data; context: PersonBlockContext }) {
  return (
    <div className="oad-person-doc">
      <Render config={serverConfigFor(kind)} data={data} metadata={{ person: context }} />
    </div>
  );
}

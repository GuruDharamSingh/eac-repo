"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSeries,
  updateSeries,
  setSeriesStatus,
  setWeekFocus,
  addLotToSeries,
  removeLotFromSeries,
  renumberSeriesLots,
  setSeriesMember,
  removeSeriesMember,
  type SeriesInput,
} from "@elkdonis/commerce/server";
import { getCurrentUserId } from "@/lib/marketplace-auth";

type Result = { ok: boolean; error?: string };

function fail(err: unknown): Result {
  return { ok: false, error: err instanceof Error ? err.message : "Failed." };
}

async function actor(): Promise<string> {
  const id = await getCurrentUserId();
  if (!id) redirect("/login?next=/admin/series");
  return id;
}

function touch(id?: string, slug?: string) {
  revalidatePath("/admin/series");
  if (id) revalidatePath(`/admin/series/${id}`);
  if (slug) {
    revalidatePath(`/series/${slug}`);
    revalidatePath(`/series/${slug}/live`);
  }
  revalidatePath("/");
}

export async function createSeriesAction(input: { title: string; subtitle?: string | null }): Promise<Result & { id?: string }> {
  try {
    const userId = await actor();
    const r = await createSeries({ actorUserId: userId, title: input.title, subtitle: input.subtitle ?? null });
    touch(r.id, r.slug);
    return { ok: true, id: r.id };
  } catch (err) {
    return fail(err);
  }
}

export async function updateSeriesAction(seriesId: string, slug: string, input: SeriesInput): Promise<Result> {
  try {
    await updateSeries(seriesId, await actor(), input);
    touch(seriesId, slug);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function setSeriesStatusAction(seriesId: string, slug: string, status: "draft" | "published" | "closed"): Promise<Result> {
  try {
    await setSeriesStatus(seriesId, await actor(), status);
    touch(seriesId, slug);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function setWeekFocusAction(seriesId: string, slug: string, weekNo: number, input: { focus?: string | null; title?: string | null; brief?: string | null }): Promise<Result> {
  try {
    await setWeekFocus(seriesId, await actor(), weekNo, input);
    touch(seriesId, slug);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function addLotToSeriesAction(seriesId: string, slug: string, lotId: string): Promise<Result> {
  try {
    await addLotToSeries(seriesId, await actor(), lotId);
    touch(seriesId, slug);
    revalidatePath(`/lots/${lotId}`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function removeLotFromSeriesAction(seriesId: string, slug: string, lotId: string): Promise<Result> {
  try {
    await removeLotFromSeries(seriesId, await actor(), lotId);
    touch(seriesId, slug);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function renumberSeriesLotsAction(seriesId: string, slug: string, orderedLotIds: string[]): Promise<Result> {
  try {
    await renumberSeriesLots(seriesId, await actor(), orderedLotIds);
    touch(seriesId, slug);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function setSeriesMemberAction(seriesId: string, email: string, role: "editor" | "contributor"): Promise<Result> {
  try {
    const r = await setSeriesMember(seriesId, await actor(), email, role);
    if (r.ok) touch(seriesId);
    return r;
  } catch (err) {
    return fail(err);
  }
}

export async function removeSeriesMemberAction(seriesId: string, userId: string): Promise<Result> {
  try {
    const r = await removeSeriesMember(seriesId, await actor(), userId);
    if (r.ok) touch(seriesId);
    return r;
  } catch (err) {
    return fail(err);
  }
}

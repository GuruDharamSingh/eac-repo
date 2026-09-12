/**
 * astro_charts read/write layer.
 *
 * Conventions carried from pigeonshoot's data.ts:
 *  - Reads are FAIL-SOFT (catch → [] / null): a broken query renders an empty
 *    list, not a 500. Writes throw, so the API can report them.
 *  - snake_case rows stay in this file; callers get camelCase types.
 *
 * Every query is scoped by the KEEPER (owner account or guest cookie) as well
 * as id — a chart id alone never reads or changes a row.
 *
 * `computed` is a cache of the engine's output. It is refreshed whenever the
 * engine version moves on, so a fix in @elkdonis/astro reaches saved charts
 * the next time they're opened.
 */

import { db } from "@elkdonis/db";
import type { ChartResult, HouseSystemCode, SignKey } from "@elkdonis/astro";
import { calculateChart, ENGINE_VERSION } from "@elkdonis/astro/server";
import { siteConfig } from "@/config/site";
import type { Keeper } from "@/lib/auth";
import type { BirthData } from "@/lib/validation";

function jsonb(value: unknown) {
  return db.json(value as Parameters<typeof db.json>[0]);
}

/** WHERE fragment selecting the keeper's own charts. A guest never sees claimed (owned) rows. */
function keptBy(k: Keeper) {
  return k.kind === "user"
    ? db`owner_id = ${k.userId}`
    : db`guest_id = ${k.guestId} AND owner_id IS NULL`;
}

interface ChartRow {
  id: string;
  name: string;
  birth_date: string;
  birth_time: string;
  timezone: string;
  location_name: string | null;
  latitude: number;
  longitude: number;
  house_system: HouseSystemCode;
  time_known: boolean;
  is_favorite: boolean;
  notes: string | null;
  computed: ChartResult | null;
  computed_version: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ChartListItem {
  id: string;
  name: string;
  birthDate: string;
  birthTime: string;
  locationName: string | null;
  isFavorite: boolean;
  createdAt: string;
  sun: SignKey | null;
  moon: SignKey | null;
  rising: SignKey | null;
  /** The cached chart, when the engine version matches — for a card's wheel. */
  chart: ChartResult | null;
}

export interface SavedChart {
  id: string;
  name: string;
  birth: Required<Omit<BirthData, "locationName">> & { locationName: string | null };
  isFavorite: boolean;
  notes: string | null;
  createdAt: string;
  chart: ChartResult;
}

// DATE/TIME as text: postgres.js would otherwise hand back a JS Date shifted by
// the server's zone, which is exactly the class of bug this app exists to fix.
// A function, not a shared constant: a postgres.js fragment is a pending query
// object, so each statement gets its own.
const columns = () => db`
  id, name,
  to_char(birth_date, 'YYYY-MM-DD') AS birth_date,
  to_char(birth_time, 'HH24:MI:SS') AS birth_time,
  timezone, location_name, latitude, longitude, house_system, time_known,
  is_favorite, notes, computed, computed_version, created_at, updated_at
`;

function birthOf(row: ChartRow): SavedChart["birth"] {
  return {
    date: row.birth_date,
    // HH:MM unless seconds were actually entered.
    time: row.birth_time.endsWith(":00") ? row.birth_time.slice(0, 5) : row.birth_time,
    timezone: row.timezone,
    latitude: row.latitude,
    longitude: row.longitude,
    houseSystem: row.house_system,
    timeKnown: row.time_known,
    locationName: row.location_name,
  };
}

function compute(birth: SavedChart["birth"]): ChartResult {
  return calculateChart({
    date: birth.date,
    time: birth.time,
    timezone: birth.timezone,
    latitude: birth.latitude,
    longitude: birth.longitude,
    houseSystem: birth.houseSystem,
    timeKnown: birth.timeKnown,
  });
}

export async function listCharts(keeper: Keeper): Promise<ChartListItem[]> {
  try {
    const rows = await db<ChartRow[]>`
      SELECT ${columns()}
      FROM astro_charts
      WHERE ${keptBy(keeper)} AND org_id = ${siteConfig.orgId}
      ORDER BY is_favorite DESC, created_at DESC
    `;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      birthDate: r.birth_date,
      birthTime: r.time_known ? r.birth_time.slice(0, 5) : "time unknown",
      locationName: r.location_name,
      isFavorite: r.is_favorite,
      createdAt: r.created_at.toISOString(),
      sun: r.computed?.summary.sun ?? null,
      moon: r.computed?.summary.moon ?? null,
      rising: r.computed?.summary.rising ?? null,
      chart: r.computed && r.computed_version === ENGINE_VERSION ? r.computed : null,
    }));
  } catch (err) {
    console.error("[elastrocal] listCharts failed", err);
    return [];
  }
}

export async function getChart(id: string, keeper: Keeper): Promise<SavedChart | null> {
  let row: ChartRow | undefined;
  try {
    [row] = await db<ChartRow[]>`
      SELECT ${columns()}
      FROM astro_charts
      WHERE id = ${id} AND ${keptBy(keeper)} AND org_id = ${siteConfig.orgId}
    `;
  } catch (err) {
    // Includes a malformed uuid in the URL.
    console.error("[elastrocal] getChart failed", err);
    return null;
  }
  if (!row) return null;

  const birth = birthOf(row);
  let chart = row.computed;
  if (!chart || row.computed_version !== ENGINE_VERSION) {
    chart = compute(birth);
    await db`
      UPDATE astro_charts
      SET computed = ${jsonb(chart)}, computed_version = ${ENGINE_VERSION}
      WHERE id = ${id}
    `.catch((err) => console.error("[elastrocal] cache refresh failed", err));
  }

  return {
    id: row.id,
    name: row.name,
    birth,
    isFavorite: row.is_favorite,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
    chart,
  };
}

export async function createChart(
  keeper: Keeper,
  input: BirthData & { name: string; isFavorite: boolean },
): Promise<string> {
  const birth: SavedChart["birth"] = {
    date: input.date,
    time: input.time,
    timezone: input.timezone,
    latitude: input.latitude,
    longitude: input.longitude,
    houseSystem: input.houseSystem,
    timeKnown: input.timeKnown,
    locationName: input.locationName || null,
  };
  // Computing before the insert doubles as validation: bad input throws
  // ChartInputError and nothing is written.
  const chart = compute(birth);
  const ownerId = keeper.kind === "user" ? keeper.userId : null;
  const guestId = keeper.kind === "guest" ? keeper.guestId : null;

  const [row] = await db<{ id: string }[]>`
    INSERT INTO astro_charts (
      org_id, owner_id, guest_id, name,
      birth_date, birth_time, timezone, location_name, latitude, longitude, house_system, time_known,
      is_favorite, computed, computed_version
    ) VALUES (
      ${siteConfig.orgId}, ${ownerId}, ${guestId}, ${input.name},
      ${birth.date}, ${birth.time}, ${birth.timezone}, ${birth.locationName}, ${birth.latitude}, ${birth.longitude}, ${birth.houseSystem}, ${birth.timeKnown},
      ${input.isFavorite}, ${jsonb(chart)}, ${ENGINE_VERSION}
    )
    RETURNING id
  `;
  return row.id;
}

export async function updateChart(
  id: string,
  keeper: Keeper,
  patch: { name?: string; isFavorite?: boolean; notes?: string | null },
): Promise<boolean> {
  const rows = await db`
    UPDATE astro_charts SET
      name        = COALESCE(${patch.name ?? null}, name),
      is_favorite = COALESCE(${patch.isFavorite ?? null}, is_favorite),
      notes       = CASE WHEN ${patch.notes !== undefined} THEN ${patch.notes ?? null} ELSE notes END,
      updated_at  = now()
    WHERE id = ${id} AND ${keptBy(keeper)} AND org_id = ${siteConfig.orgId}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function deleteChart(id: string, keeper: Keeper): Promise<boolean> {
  const rows = await db`
    DELETE FROM astro_charts
    WHERE id = ${id} AND ${keptBy(keeper)} AND org_id = ${siteConfig.orgId}
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * A guest signed in: their charts become the account's. Returns how many
 * moved. Idempotent — once claimed, guest_id is cleared and the cookie's id
 * matches nothing.
 */
export async function claimGuestCharts(guestId: string, userId: string): Promise<number> {
  try {
    const rows = await db`
      UPDATE astro_charts
      SET owner_id = ${userId}, guest_id = NULL, updated_at = now()
      WHERE guest_id = ${guestId} AND owner_id IS NULL AND org_id = ${siteConfig.orgId}
      RETURNING id
    `;
    return rows.length;
  } catch (err) {
    console.error("[elastrocal] claimGuestCharts failed", err);
    return 0;
  }
}

import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { requireUser } from "@/lib/session";
import { businessWizardSchema } from "@/lib/business-schema";

export async function POST(req: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = businessWizardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const a = parsed.data;

  const orgRows = await db<{ org_id: string }[]>`
    SELECT org_id FROM user_organizations
    WHERE user_id = ${user.id} AND role = 'owner' LIMIT 1
  `;
  const orgId = orgRows[0]?.org_id;
  if (!orgId) {
    return NextResponse.json({ error: "No org" }, { status: 400 });
  }

  const fields: Record<string, unknown> = {};
  const set = (col: string, val: unknown) => {
    fields[col] = val ?? null;
  };

  set("biz_entity_type", a.entityType);
  set("biz_entity_name", a.entityName || null);
  set("biz_mission", a.mission || null);
  set("biz_legal_status", a.legalStatus);
  
  set("biz_primary_revenue", a.primaryRevenue);
  set("biz_capacity", a.capacity || null);
  set("biz_pricing_philosophy", a.pricingPhilosophy);

  set("biz_tools", a.tools || null);
  set("biz_fulfillment", a.fulfillment);
  set("biz_inventory_management", a.inventoryManagement || null);

  set("biz_desired_resources", a.desiredResources);
  set("biz_revenue_sharing", a.revenueSharing || null);
  set("biz_skill_share", a.skillShare || null);

  set("biz_main_barrier", a.mainBarrier || null);
  set("biz_revenue_goal", a.revenueGoal || null);

  try {
    await db`
      INSERT INTO artist_profiles (user_id, org_id)
      VALUES (${user.id}, ${orgId})
      ON CONFLICT (user_id) DO UPDATE SET ${db(fields)}
    `;
  } catch (err) {
    console.error("business wizard submit failed", err);
    return NextResponse.json(
      { error: "Could not submit workbook" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

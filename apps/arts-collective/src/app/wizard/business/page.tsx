import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { BusinessWizardProvider } from "@/components/wizard/BusinessWizardProvider";
import { BusinessWizardRenderer } from "@/components/wizard/BusinessWizardRenderer";
import type { BusinessWizardAnswers } from "@/lib/business-schema";

export default async function BusinessWizardPage() {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);

  if (!profile) {
    redirect("/signup/setup");
  }

  // Map database profile to BusinessWizardAnswers
  const initial: Partial<BusinessWizardAnswers> = {
    entityType: (profile.biz_entity_type as any) ?? "individual",
    entityName: profile.biz_entity_name || "",
    mission: profile.biz_mission || "",
    legalStatus: (profile.biz_legal_status as any) ?? "just_starting",
    
    primaryRevenue: (profile.biz_primary_revenue ?? []) as any,
    capacity: profile.biz_capacity || "",
    pricingPhilosophy: (profile.biz_pricing_philosophy as any) ?? "materials_plus_labor",

    tools: profile.biz_tools || "",
    fulfillment: (profile.biz_fulfillment as any) ?? "self",
    inventoryManagement: profile.biz_inventory_management || "",

    desiredResources: (profile.biz_desired_resources ?? []) as any,
    revenueSharing: profile.biz_revenue_sharing || "",
    skillShare: profile.biz_skill_share || "",

    mainBarrier: profile.biz_main_barrier || "",
    revenueGoal: profile.biz_revenue_goal || "",
  };

  return (
    <BusinessWizardProvider userId={user.id} initialAnswers={initial}>
      <BusinessWizardRenderer />
    </BusinessWizardProvider>
  );
}

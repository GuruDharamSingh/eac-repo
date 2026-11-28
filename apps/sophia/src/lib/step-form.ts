import { actionForm, actionMeta, confirmView, isMoneyMeta, type ConfirmCard, type ConfirmMode } from "@elkdonis/actions";
import type { LoadedForm } from "@elkdonis/actions";
import { actionOrgId, actionStatus, loadDockForm, REGISTRY_CONFIRM } from "@elkdonis/actions/server";
import { getCourseBySlug, getLearnerOutline, stepTask } from "@elkdonis/lms";
import { isAdmin } from "@elkdonis/auth-server";
import { getDockUser } from "@/lib/dock-user";
import { DOCK_LINKS } from "@/lib/dock-links";

export interface StepFormData { entry: string; title: string; loaded: LoadedForm; confirm: ConfirmCard }

/**
 * The declared form for a lesson step (2026-11-27): when the step is a task step whose entry has a
 * declared form (the one the dock uses elsewhere), the lesson page shows that form inline instead of
 * sending the person away. Null when there is none (signed out, not a task, no form, money, done already).
 */
export async function getStepForm(courseSlug: string, stepSlug: string): Promise<StepFormData | null> {
  try {
    const user = await getDockUser();
    if (!user) return null;
    const course = await getCourseBySlug(courseSlug);
    if (!course) return null;
    const outline = await getLearnerOutline({ userId: user.id, roles: {} }, { courseId: course.id });
    const step = outline?.steps.find((s) => s.slug === stepSlug);
    if (!step || !step.access.allowed || step.status === "completed" || step.status === "waived") return null;
    const task = stepTask(step);
    if (!task || !actionForm(task.id)) return null;
    const meta = actionMeta(task.id);
    if (!meta || !meta.runnable || !meta.dockForm || isMoneyMeta(meta)) return null;
    const orgId = await actionOrgId(task.id, user.id, null);
    if (meta.scope === "org" && !orgId) return null;
    const params = task.params ?? null;
    const status = await actionStatus(task.id, { userId: user.id, orgId: task.scope === "org" ? orgId : null, links: DOCK_LINKS, params });
    const loaded = await loadDockForm(task.id, { userId: user.id, orgId, links: DOCK_LINKS, params }, { status });
    if (!loaded) return null;
    const mode: ConfirmMode = process.env.NODE_ENV !== "production" || (await isAdmin(user.id).catch(() => false)) ? "draft-visible" : "live";
    const vars: Record<string, string> = {};
    for (const [ph, field] of Object.entries<string>(loaded.form.confirmVars ?? {})) vars[ph] = loaded.values[field] ?? "";
    const confirm = confirmView({ ...meta, confirm: REGISTRY_CONFIRM[meta.id] ?? meta.confirm }, mode, vars, loaded.form.confirmVars);
    return { entry: task.id, title: meta.label, loaded, confirm };
  } catch (err) {
    console.error("[sophia] step form:", err);
    return null;
  }
}

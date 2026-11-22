import { renderForumRoute } from "@elkdonis/forum-ui";
import type { ReactNode } from "react";
import { getForumConnectors } from "@/lib/forum";
import { getViewer } from "@/lib/auth";
import { getWorkQuestion, getWorkQuestionThread } from "@/lib/landing";

// ============================================================================
// What the "Grand forum" block (grand-forum) reads, for the block's server resolver (config.server.ts): the work
// question, the thread it lives in, the forum opened on that thread, and whether the viewer is signed in. The same
// three reads and the same render app/page.tsx made for the live part; a failed forum render leaves the band
// without the conversation rather than failing the page, as before.
// ============================================================================

export interface ForumData {
  embed: ReactNode;
  question: { id: string; question: string } | null;
  signedIn: boolean;
}

export async function loadForumData(): Promise<ForumData> {
  const [workQuestion, viewer] = await Promise.all([getWorkQuestion(), getViewer().catch(() => null)]);
  const thread = workQuestion ? await getWorkQuestionThread(workQuestion.question.question) : null;
  const embed = thread
    ? await renderForumRoute({
        connectors: await getForumConnectors(),
        segments: ["t", thread.id, thread.slug],
        searchParams: {},
      }).catch((err) => {
        console.error("[innergathering] landing forum embed:", err);
        return null;
      })
    : null;
  return {
    embed,
    question: workQuestion ? { id: workQuestion.question.id, question: workQuestion.question.question } : null,
    signedIn: Boolean(viewer),
  };
}

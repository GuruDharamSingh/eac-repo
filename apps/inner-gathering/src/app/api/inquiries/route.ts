import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

const ORG_ID = "elkdonis";
const MAX_ANSWER_LEN = 2000;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { prompt?: string; answer?: string };
    const prompt = body.prompt?.trim();
    const answer = body.answer?.trim();

    if (!prompt || !answer) {
      return NextResponse.json(
        { error: "Both prompt and answer are required." },
        { status: 400 }
      );
    }
    if (answer.length < 2) {
      return NextResponse.json(
        { error: "Please write a little more." },
        { status: 400 }
      );
    }
    const trimmedAnswer = answer.slice(0, MAX_ANSWER_LEN);
    const trimmedPrompt = prompt.slice(0, 280);

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "anonymous";
    const ipHash = createHash("sha256")
      .update(ip + (process.env.EAC_IP_HASH_SALT ?? "elkdonis"))
      .digest("hex")
      .slice(0, 32);
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

    const { db } = await import("@elkdonis/db");
    await db`
      INSERT INTO landing_inquiries (org_id, prompt, answer, ip_hash, user_agent)
      VALUES (${ORG_ID}, ${trimmedPrompt}, ${trimmedAnswer}, ${ipHash}, ${userAgent})
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[eac] inquiry failed:", err);
    return NextResponse.json(
      { error: "Could not record your response." },
      { status: 500 }
    );
  }
}

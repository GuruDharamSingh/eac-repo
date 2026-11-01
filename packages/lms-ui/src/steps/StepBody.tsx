import type { OutlineStepView, StepMedia, ThreadRef } from "@elkdonis/lms";
import { stepTask, stepTypeDef } from "@elkdonis/lms";
import type { LmsConnectors } from "../connectors";
import { fmtWhen } from "../parts";

/**
 * What a step shows, by type. Types are leaves: everything here is driven by
 * the step version's own title/body/settings/refs, so a type nobody has
 * registered still shows its media, its body and its practice.
 */
export async function StepBody({ step, c, thread, enrolled = false, here = "", orgId = null }: {
  step: OutlineStepView; c: LmsConnectors; thread: ThreadRef | null;
  /** For task steps: whether a finished task is recorded, and where "come back" returns to. */
  enrolled?: boolean; here?: string; orgId?: string | null;
}) {
  const def = stepTypeDef(step.type);
  const media = step.refs.media ?? [];
  const task = stepTask(step);
  return (
    <>
      {media.map((m, i) => <Media key={i} m={m} c={c} />)}
      {step.bodyHtml && <div className="so-prose" dangerouslySetInnerHTML={{ __html: step.bodyHtml }} />}
      {task && <TaskBox task={task} step={step} c={c} enrolled={enrolled} here={here} orgId={orgId} />}
      {def.needsThread && <ThreadCard thread={thread} c={c} kind={step.type} />}
      {(step.refs.links ?? []).length > 0 && (
        <ul className="so-links" aria-label="Further reading">
          {step.refs.links!.map((l) => (
            <li key={l.url}>
              <a href={l.url} rel="noopener noreferrer external" target="_blank">
                <span className="so-kicker">{l.siteName ?? new URL(l.url).hostname} ↗</span>
                <strong>{l.title}</strong>
                {l.description && <span>{l.description}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
      {step.settings.practice && (
        <section className="so-practice" aria-labelledby="practice-h">
          <h2 id="practice-h">The practice</h2>
          <p>{String(step.settings.practice)}</p>
          {step.settings.alternative && (
            <details>
              <summary>Another way in</summary>
              <p>{String(step.settings.alternative)}</p>
            </details>
          )}
        </section>
      )}
    </>
  );
}

/**
 * The box a task step draws under its text. The page has already asked the
 * host whether the task is done (settleTaskStep, before the outline was read),
 * so a second status read here is answered from the host's per-request cache.
 */
async function TaskBox({ task, step, c, enrolled, here, orgId }: { task: NonNullable<ReturnType<typeof stepTask>>; step: OutlineStepView; c: LmsConnectors; enrolled: boolean; here: string; orgId: string | null }) {
  if (!c.tasks) {
    return <p className="so-callout">This step is done on the network itself; this site cannot do it from here.</p>;
  }
  const viewer = await c.viewer();
  const done = step.status === "completed" || step.status === "waived";
  const status = done ? { done: true } : await c.tasks.status(task, viewer, { orgId }).catch(() => ({ done: false }));
  const Box = c.tasks.render;
  return (
    <section className="so-task" aria-label="What to do">
      <Box task={task} status={status} signedIn={Boolean(viewer.userId)} enrolled={enrolled} here={here} signInHref={c.hrefs.signIn(here)} orgId={orgId} />
    </section>
  );
}

function Media({ m, c }: { m: StepMedia; c: LmsConnectors }) {
  const src = c.mediaUrl(m.url);
  return (
    <figure className="so-media">
      {m.kind === "audio" && <audio controls preload="metadata" src={src} />}
      {m.kind === "video" && <video controls preload="metadata" playsInline src={src} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {m.kind === "image" && <img src={src} alt={m.title ?? ""} loading="lazy" />}
      {m.kind === "file" && <a className="so-btn so-btn--quiet" href={src} download>Download {m.title ?? "the file"}</a>}
      {(m.title || m.kind === "audio") && (
        <figcaption>
          {m.title}
          {m.kind === "audio" && <> · <a href={src} download>Download to listen offline</a></>}
        </figcaption>
      )}
      {m.transcript && (
        <details className="so-transcript">
          <summary>Transcript</summary>
          <div>{m.transcript.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
        </details>
      )}
    </figure>
  );
}

function ThreadCard({ thread, c, kind }: { thread: ThreadRef | null; c: LmsConnectors; kind: string }) {
  if (!thread || !thread.available) {
    return <p className="so-callout">{kind === "session" ? "This gathering isn’t on the calendar right now." : "This conversation isn’t open right now."} Carry on with the rest — it doesn’t hold you back.</p>;
  }
  const href = c.hrefs.forumThread(thread.id, thread.slug);
  const live = kind === "session";
  return (
    <aside className="so-ref">
      <span className="so-kicker">{live ? "A gathering on the network" : "A conversation on the forum"} · {thread.orgName}</span>
      <h2><a href={href}>{thread.title}</a></h2>
      {thread.excerpt && <p>{thread.excerpt}</p>}
      <dl>
        {thread.scheduledAt && <><dt>{thread.recurring ? "Meets" : "When"}</dt><dd>{thread.recurring ? "Regularly — next times are on its page" : fmtWhen(thread.scheduledAt)}</dd></>}
        {thread.durationMinutes ? <><dt>Length</dt><dd>{thread.durationMinutes} minutes</dd></> : null}
        {(thread.location || thread.isOnline) && <><dt>Where</dt><dd>{thread.isOnline || thread.hasTalkRoom ? "Online" : thread.location}{thread.hasTalkRoom ? " — the room opens from its page, no account needed" : ""}</dd></>}
        {!live && <><dt>So far</dt><dd>{thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"}</dd></>}
      </dl>
      <a className="so-btn so-btn--quiet" href={href}>{live ? "See times and join" : "Read and take part"} →</a>
    </aside>
  );
}

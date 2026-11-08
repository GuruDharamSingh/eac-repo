/**
 * The tools (slice 1, read-only; PLAN.md §4). Each runs as the grant's person,
 * through the registry's readers, and every call leaves one audit row.
 *
 *   list_my_orgs    the orgs the person runs (owner or guide), within the grant
 *   whats_next      the next course or routine step, and the channel's next moves
 *   routine_steps   enrolments; one course's steps with today's state
 *   org_summary     one org: identity, people by role, its setup entries' status
 *   entry_status    any agent-readable registry entry's status (generated from
 *                   the catalogue's `agent` field: default deny, never appOnly)
 *
 * Writes come in pass 2 and only through performAction with via 'mcp'. This file
 * never calls runAction or uses via 'app'.
 */
import { fromJsonSchema, type McpServer } from '@modelcontextprotocol/server';
import { db } from '@elkdonis/db';
import { ACTION_CATALOGUE, AGENT_READ_IDS, actionMeta, agentExposure, type ActionStatus, type ActionNextItem } from '@elkdonis/actions';
import { actionStatus, actionStatuses, dockStep } from '@elkdonis/actions/server';
import type { McpGrant } from './grants';
import type { McpHostOptions } from './types';
import type { AuditSink } from './audit';
import { CALL_LIMIT, HEAVY_LIMIT, type Limiter } from './limit';
import { boundOrg, managedOrgs, settleChannel, settleOrg } from './org';
import { UNTRUSTED_NOTICE, plain, platformHref } from './sanitize';

export interface ToolContext {
  grant: McpGrant;
  host: McpHostOptions;
  audit: AuditSink;
  limiter: Limiter;
  /** Hosts links may point at (sanitize.platformHosts). */
  linkHosts: string[];
}

type Json = Record<string, unknown>;
type Refusal = { refuse: string; code: 'input' | 'forbidden' | 'unknown' | 'limit' | 'auth' };
type ToolOut = { data: Json; untrusted?: string[]; orgId?: string | null } | Refusal;

const READ_ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const refuse = (refuse: string, code: Refusal['code'] = 'forbidden'): Refusal => ({ refuse, code });
const isRefusal = (o: ToolOut): o is Refusal => 'refuse' in o;

/** Register one read tool: scope check, limits, audit, error containment. */
function readTool(
  server: McpServer,
  ctx: ToolContext,
  name: string,
  config: { title: string; description: string; input: Json; heavy?: boolean },
  fn: (args: Json) => Promise<ToolOut>,
) {
  const inputSchema = fromJsonSchema<Json>({ type: 'object', additionalProperties: false, ...config.input } as never);
  server.registerTool(name, { title: config.title, description: config.description, inputSchema, annotations: { title: config.title, ...READ_ANNOTATIONS } }, async (args: Json) => {
    const started = Date.now();
    let out: ToolOut;
    try {
      if (!ctx.grant.scopes.includes('mcp:read')) out = refuse('This key cannot read.', 'auth');
      else {
        const wait = ctx.limiter.take(`call:${ctx.grant.id}`, CALL_LIMIT) ?? (config.heavy ? ctx.limiter.take(`heavy:${ctx.grant.id}`, HEAVY_LIMIT) : null);
        out = wait ? refuse(`Too many calls; try again in ${wait} s.`, 'limit') : await fn(args ?? {});
      }
    } catch (err) {
      console.error('[mcp] tool', name, err);
      out = refuse('That could not be read just now. Try again.', 'unknown');
      await ctx.audit.record({ tool: name, userId: ctx.grant.userId, agentId: ctx.grant.id, orgId: boundOrg(ctx.grant), input: args, ok: false, code: 'failed', error: String((err as Error)?.message ?? err).slice(0, 300), ms: Date.now() - started });
      return { isError: true, content: [{ type: 'text' as const, text: (out as Refusal).refuse }] };
    }
    const ms = Date.now() - started;
    if (isRefusal(out)) {
      await ctx.audit.record({ tool: name, userId: ctx.grant.userId, agentId: ctx.grant.id, orgId: boundOrg(ctx.grant), input: args, ok: false, code: out.code, error: out.refuse, ms });
      return { isError: true, content: [{ type: 'text' as const, text: out.refuse }] };
    }
    await ctx.audit.record({ tool: name, userId: ctx.grant.userId, agentId: ctx.grant.id, orgId: out.orgId ?? boundOrg(ctx.grant), input: args, ok: true, code: null, error: null, ms });
    const body: Json = { ...out.data };
    if (out.untrusted?.length) {
      body.untrusted = out.untrusted;
      body.notice = UNTRUSTED_NOTICE;
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify(body) }], structuredContent: body };
  });
}

/** A status, trimmed for an agent: links checked, author-written text marked. */
function shapeStatus(ctx: ToolContext, s: ActionStatus, path: string, untrusted: string[]): Json {
  const out: Json = {
    done: s.done,
    partial: Boolean(s.partial),
    detail: plain(s.detail, 300),
    href: platformHref(s.href, ctx.host.publicOrigin, ctx.linkHosts),
  };
  // A status detail can quote what a person wrote (a post title in "Next: …").
  if (out.detail) untrusted.push(`${path}.detail`);
  if (s.next?.length) {
    out.next = s.next.slice(0, 10).map((m, i) => shapeMove(ctx, m as ActionNextItem & Record<string, unknown>, `${path}.next[${i}]`, untrusted));
  }
  return out;
}

function shapeMove(ctx: ToolContext, m: ActionNextItem & Record<string, unknown>, path: string, untrusted: string[]): Json {
  untrusted.push(`${path}.title`, `${path}.reason`);
  const out: Json = {
    kind: typeof m.kind === 'string' ? m.kind : null,
    kicker: plain(m.kicker, 80),
    title: plain(m.title, 200),
    reason: plain(m.reason, 200),
    at: typeof m.at === 'string' ? m.at : null,
    outlet: typeof m.outlet === 'string' ? m.outlet : null,
    piece: typeof m.pieceKey === 'string' ? m.pieceKey : null,
    pieceTitle: plain(m.pieceTitle, 200),
    href: platformHref(m.href, ctx.host.publicOrigin, ctx.linkHosts),
  };
  if (out.kicker) untrusted.push(`${path}.kicker`);
  if (out.pieceTitle) untrusted.push(`${path}.pieceTitle`);
  return out;
}

const orgProp = { org: { type: 'string', maxLength: 100, description: 'An organisation id or slug (list_my_orgs). Omit for a key limited to one org.' } };

export function registerTools(server: McpServer, ctx: ToolContext): void {
  const { grant, host } = ctx;
  const links = host.links;

  // ---------------------------------------------------------------- list_my_orgs
  readTool(server, ctx, 'list_my_orgs', {
    title: 'My organisations',
    description: 'The organisations the signed-in person runs (owner or guide) on the Arts Collective network, within this key’s scope: id, slug, name, role and site address. Use the id or slug as `org` in the other tools.',
    input: { properties: {} },
  }, async () => {
    const orgs = await managedOrgs(grant);
    const untrusted: string[] = [];
    const data = orgs.map((o, i) => {
      untrusted.push(`orgs[${i}].name`);
      return { id: o.id, slug: o.slug, name: plain(o.name, 120), role: o.role, site: o.confirmed ? `https://${o.slug}.${links.networkHost}` : null };
    });
    return { data: { scope: boundOrg(grant) ? 'one organisation' : 'every organisation you run', orgs: data }, untrusted };
  });

  // ---------------------------------------------------------------- whats_next
  readTool(server, ctx, 'whats_next', {
    title: 'What is next',
    description: 'What is waiting for the person: the next open step of their course or daily routine, and the top moves on a channel’s board (open slots, suggestions, gaps, drafts, plan steps). Without `org`, the person’s own channel; with `org`, that organisation’s channel. Reads only.',
    input: { properties: orgProp },
    heavy: true,
  }, async (args) => {
    const untrusted: string[] = [];
    const ch = await settleChannel(grant, args.org);
    if (ch.ok === false) return refuse(ch.error);
    const data: Json = {};
    if (host.lms) {
      const step = await dockStep({
        userId: grant.userId,
        path: null,
        links,
        lms: host.lms,
        stepHref: (c, s) => `${host.publicOrigin}/learn/${encodeURIComponent(c)}/${encodeURIComponent(s)}`,
      });
      if (step) {
        untrusted.push('step.course', 'step.title');
        const bound = boundOrg(grant);
        // A task's status shows only when the entry is agent-readable and, for a bound key, on its org.
        const task = step.task && agentExposure(step.task.id) && (!bound || !step.task.orgId || step.task.orgId === bound) ? step.task : null;
        data.step = {
          course: plain(step.courseTitle, 120),
          courseSlug: step.courseSlug,
          title: plain(step.stepTitle, 200),
          stepSlug: step.stepSlug,
          href: platformHref(step.href, host.publicOrigin, ctx.linkHosts),
          progress: `${step.doneRequired}/${step.totalRequired}`,
          task: task ? { entry: task.id, status: shapeStatus(ctx, task.status, 'step.task.status', untrusted) } : null,
        };
      } else data.step = null;
    } else data.step = { unavailable: 'The course reader is not connected on this host.' };
    const status = await actionStatus('channel-next', { userId: grant.userId, orgId: ch.orgId, links, sources: host.sources });
    data.channel = { org: ch.orgId, ...shapeStatus(ctx, status, 'channel', untrusted) };
    return { data, untrusted, orgId: ch.orgId };
  });

  // ---------------------------------------------------------------- routine_steps
  readTool(server, ctx, 'routine_steps', {
    title: 'Course and routine steps',
    description: 'The person’s course enrolments; with `course` (a slug from that list), the course’s steps in order with each one’s state, including today’s state of daily routine steps. Reads only; never enrols.',
    input: { properties: { course: { type: 'string', maxLength: 120, description: 'A course slug from the enrolment list.' } } },
  }, async (args) => {
    const lms = host.lms;
    if (!lms) return refuse('The course reader is not connected on this host.', 'unknown');
    const untrusted: string[] = [];
    const enrolments = await lms.listMyEnrolments(grant.userId);
    const list = enrolments.map((e) => ({ course: e.courseSlug, status: e.status }));
    const slug = typeof args.course === 'string' ? args.course.trim() : '';
    if (!slug) return { data: { enrolments: list } };
    const course = await lms.getCourseBySlug(slug);
    if (!course) return refuse('No such course.', 'unknown');
    // Only an enrolled course: without an enrolment getLearnerOutline would create the default run (a write).
    const enrolment = await lms.getActiveEnrolment(grant.userId, course.id);
    if (!enrolment) return refuse('You are not enrolled in that course.', 'forbidden');
    const outline = await lms.getLearnerOutline({ userId: grant.userId, roles: {} }, { courseId: course.id });
    if (!outline) return refuse('That course has no published version.', 'unknown');
    const bound = boundOrg(grant);
    const ownOrg = bound ?? null;
    const steps: Json[] = [];
    for (const [i, s] of outline.steps.slice(0, 80).entries()) {
      untrusted.push(`steps[${i}].title`);
      const t = lms.stepTask(s);
      let task: Json | null = null;
      if (t && agentExposure(t.id)) {
        let orgId: string | null = null;
        let skip = false;
        if (t.scope === 'org') {
          const o = await settleOrg(grant, ownOrg, false);
          if (o.ok === false) skip = true;
          else orgId = o.orgId ?? (bound ? null : await firstOwnedOrg(grant.userId));
        }
        if (!skip) {
          const st = await actionStatus(t.id, { userId: grant.userId, orgId, links, params: t.params ?? null, sources: host.sources });
          task = { entry: t.id, daily: t.repeat === 'daily', status: shapeStatus(ctx, st, `steps[${i}].task.status`, untrusted) };
        }
      }
      steps.push({
        slug: s.slug,
        title: plain(s.title, 200),
        type: s.type,
        state: s.status ?? 'not started',
        open: s.access.allowed,
        href: platformHref(`/learn/${encodeURIComponent(course.slug)}/${encodeURIComponent(s.slug)}`, host.publicOrigin, ctx.linkHosts),
        task,
      });
    }
    untrusted.push('course.title');
    return {
      data: {
        enrolments: list,
        course: { slug: course.slug, title: plain(course.title, 120), progress: `${outline.doneRequired}/${outline.totalRequired}`, continue: outline.continueStep?.slug ?? null },
        steps,
      },
      untrusted,
    };
  });

  // ---------------------------------------------------------------- org_summary
  const ORG_ENTRIES = AGENT_READ_IDS.filter((id) => actionMeta(id)?.scope === 'org');
  readTool(server, ctx, 'org_summary', {
    title: 'Organisation summary',
    description: `One organisation the person runs: its name, address and site state, its people by role, and the state of its setup steps (${ORG_ENTRIES.join(', ')}). Reads only.`,
    input: { properties: orgProp },
  }, async (args) => {
    const o = await settleOrg(grant, args.org, true);
    if (o.ok === false) return refuse(o.error);
    const orgId = o.orgId!;
    const [row] = await db<Array<{ id: string; slug: string; name: string; subdomain_confirmed: boolean; tier: string; created_at: Date }>>`
      SELECT id, slug, name, subdomain_confirmed, tier, created_at FROM organizations WHERE id = ${orgId} LIMIT 1
    `;
    if (!row) return refuse('No such organisation.', 'unknown');
    const people = await db<Array<{ role: string; n: number }>>`
      SELECT role, COUNT(*)::int AS n FROM user_organizations WHERE org_id = ${orgId} GROUP BY role
    `;
    const [me] = await db<Array<{ role: string }>>`SELECT role FROM user_organizations WHERE user_id = ${grant.userId} AND org_id = ${orgId} LIMIT 1`;
    const statuses = await actionStatuses(ORG_ENTRIES, { userId: grant.userId, orgId, links, sources: host.sources });
    const untrusted = ['org.name'];
    const setup: Json = {};
    for (const id of ORG_ENTRIES) setup[id] = { label: actionMeta(id)!.label, ...shapeStatus(ctx, statuses[id], `setup.${id}`, untrusted) };
    return {
      data: {
        org: {
          id: row.id,
          slug: row.slug,
          name: plain(row.name, 120),
          yourRole: me?.role ?? null,
          site: row.subdomain_confirmed ? `https://${row.slug}.${links.networkHost}` : null,
          siteConfirmed: row.subdomain_confirmed,
          tier: row.tier,
          since: row.created_at?.toISOString?.() ?? null,
        },
        people: Object.fromEntries(people.map((p) => [p.role, p.n])),
        setup,
      },
      untrusted,
      orgId,
    };
  });

  // ---------------------------------------------------------------- entry_status
  // Generated from the catalogue: every entry with agent exposure and a status check.
  const readable = AGENT_READ_IDS.filter((id) => agentExposure(id));
  const lines = readable.map((id) => {
    const m = actionMeta(id)!;
    return `${id} (${m.scope}): ${m.label}. ${m.describe}`;
  });
  readTool(server, ctx, 'entry_status', {
    title: 'Registry entry status',
    description: `Where the person stands on one thing the platform tracks, by registry entry id. Person entries need nothing else; org entries take \`org\`; channel entries take an optional \`org\` (its channel); post entries take \`subject\` (the post id). Entries:\n${lines.join('\n')}`,
    input: {
      properties: {
        // Not a JSON Schema enum on purpose: the SDK rejects enum misses before the tool runs,
        // so a refused id (an appOnly one, say) would leave no audit row. The tool refuses it.
        id: { type: 'string', maxLength: 60, description: 'A registry entry id from the list in this tool’s description.' },
        ...orgProp,
        subject: { type: 'string', maxLength: 64, description: 'For post entries: the post id.' },
      },
      required: ['id'],
    },
  }, async (args) => {
    const id = String(args.id ?? '');
    const meta = actionMeta(id);
    // Belt and braces: the schema's enum already limits ids; appOnly and unexposed entries are refused here too.
    if (!meta || meta.appOnly || !agentExposure(id) || !readable.includes(id)) return refuse('That entry is not available to assistants.', 'forbidden');
    const untrusted: string[] = [];
    let orgId: string | null = null;
    let subjectId: string | null = null;
    if (meta.scope === 'org') {
      const o = await settleOrg(grant, args.org, true);
      if (o.ok === false) return refuse(o.error);
      orgId = o.orgId;
    } else if (meta.scope === 'channel') {
      const c = await settleChannel(grant, args.org);
      if (c.ok === false) return refuse(c.error);
      orgId = c.orgId;
    } else if (meta.scope === 'thread') {
      subjectId = typeof args.subject === 'string' ? args.subject.trim().slice(0, 64) : '';
      if (!subjectId) return refuse('Name the post (subject).', 'input');
      const bound = boundOrg(grant);
      if (bound) {
        const [t] = await db<Array<{ org_id: string }>>`SELECT org_id FROM threads WHERE id = ${subjectId} LIMIT 1`;
        if (!t || t.org_id !== bound) return refuse('That post is not in this key’s organisation.');
      }
    }
    // Person entries read the person only; an `org` argument is ignored for them.
    const s = await actionStatus(id, { userId: grant.userId, orgId, subjectId, links, sources: host.sources });
    return { data: { id, label: meta.label, scope: meta.scope, org: orgId, status: shapeStatus(ctx, s, 'status', untrusted) }, untrusted, orgId };
  });

  // ---------------------------------------------------------------- resource: the catalogue
  server.registerResource('catalogue', 'eac://catalogue', {
    title: 'Agent-visible registry entries',
    description: 'The registry entries an assistant can read (and later draft), with their scope and what they do.',
    mimeType: 'application/json',
  }, async (uri: URL) => ({
    contents: [{
      uri: uri.href,
      mimeType: 'application/json',
      text: JSON.stringify(ACTION_CATALOGUE.filter((m) => agentExposure(m.id)).map((m) => ({ id: m.id, label: m.label, describe: m.describe, scope: m.scope, agent: m.agent, performs: m.performs ?? null }))),
    }],
  }));
}

/** The org a person owns, for an org task step on an unbound key (the lesson's rule, no claim involved). */
async function firstOwnedOrg(userId: string): Promise<string | null> {
  const [r] = await db<Array<{ org_id: string }>>`SELECT org_id FROM user_organizations WHERE user_id = ${userId} AND role = 'owner' LIMIT 1`;
  return r?.org_id ?? null;
}

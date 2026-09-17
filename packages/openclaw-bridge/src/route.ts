import { postForAgent } from './post';
import type { AgentIdentity, AgentPostRequest, AgentPostResult } from './types';

/**
 * Establish who is asking, from the raw request.
 *
 * Supplied by the app that mounts the handler — deliberately NOT implemented
 * here. Identity in this stack is issued by the admin OIDC provider, and this
 * package must not become a second place that knows how to mint or validate a
 * token. Return null to reject.
 */
export type VerifyAgentRequest = (
  req: Request
) => Promise<AgentIdentity | null> | AgentIdentity | null;

export interface AgentPostHandlerOptions {
  verify: VerifyAgentRequest;
  /** Bytes. Guards the JSON parse itself, before any base64 is decoded. */
  maxBodyBytes?: number;
}

const DEFAULT_MAX_BODY = 20 * 1024 * 1024;

const STATUS: Record<string, number> = {
  unknown_sender: 403,
  unknown_org: 404,
  not_a_member: 403,
  insufficient_role: 403,
  unknown_section: 404,
  invalid_request: 400,
  media_rejected: 400,
  internal_error: 500,
};

/**
 * A POST handler that turns a verified agent request into a draft thread.
 *
 * Mount it in one app and one route. Every additional mount is another thing
 * to audit, and there is no reason for a second one.
 */
export function createAgentPostHandler(options: AgentPostHandlerOptions) {
  const maxBody = options.maxBodyBytes ?? DEFAULT_MAX_BODY;

  return async function POST(req: Request): Promise<Response> {
    const identity = await options.verify(req);
    if (!identity) {
      return json({ ok: false, code: 'unknown_sender', error: 'not authorized' }, 401);
    }

    const declared = Number(req.headers.get('content-length') ?? 0);
    if (declared > maxBody) {
      return json({ ok: false, code: 'invalid_request', error: 'request too large' }, 413);
    }

    let body: AgentPostRequest;
    try {
      body = (await req.json()) as AgentPostRequest;
    } catch {
      return json({ ok: false, code: 'invalid_request', error: 'body must be JSON' }, 400);
    }

    let result: AgentPostResult;
    try {
      result = await postForAgent(identity, body);
    } catch (error) {
      console.error('[openclaw-bridge] unhandled:', error);
      return json({ ok: false, code: 'internal_error', error: 'request failed' }, 500);
    }

    return json(result, result.ok ? 201 : (STATUS[result.code] ?? 400));
  };
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

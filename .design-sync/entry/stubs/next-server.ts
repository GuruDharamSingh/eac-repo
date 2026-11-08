// Browser stub for next/server. @elkdonis/utils re-exports api-response.ts (NextResponse);
// inside a Next app that only runs server-side, but bundled for the design tool it would
// pull Next server internals that crash in the browser (__dirname). Never called by UI.
export class NextResponse extends Response {
  static json(body: unknown, init?: ResponseInit) { return new Response(JSON.stringify(body), init); }
}
export class NextRequest extends Request {}

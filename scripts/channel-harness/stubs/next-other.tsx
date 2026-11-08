import * as React from "react";
// Harness: anything else from next/* (server, headers, cache, dynamic, image).
export const NextResponse = { json: () => null, next: () => null, redirect: () => null };
export function headers() { return new Map(); }
export function cookies() { return new Map(); }
export function revalidatePath() {}
export default function dynamic(load: () => Promise<{ default: React.ComponentType<Record<string, unknown>> } | React.ComponentType<Record<string, unknown>>>) {
  return function Dyn(props: Record<string, unknown>) {
    const [C, setC] = React.useState<React.ComponentType<Record<string, unknown>> | null>(null);
    React.useEffect(() => { load().then((m) => setC(() => ("default" in (m as object) ? (m as { default: React.ComponentType<Record<string, unknown>> }).default : (m as React.ComponentType<Record<string, unknown>>)))); }, []);
    return C ? <C {...props} /> : null;
  };
}

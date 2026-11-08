// grapick 0.1.13 ships no types; StopBar.tsx declares the narrow surface it uses.
declare module "grapick" {
  const Grapick: new (options: Record<string, unknown>) => unknown;
  export default Grapick;
}

// next/font/google has no meaning outside Next. The harness page gets the real font-variable classes from the
// shadow build (sunjay-try-run.sh writes them on <html>), so sunjay's `fontVariables` has nothing to add here.
const face = () => ({ variable: "", className: "", style: {} });
export const Fraunces = face;
export const Spectral = face;

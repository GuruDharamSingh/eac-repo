// The editor's stylesheet only where the editor runs, as CanvasEditor loads it. The published mode must not have it.
const link = document.createElement("link");
link.rel = "stylesheet";
link.href = "visual.css";
document.head.appendChild(link);
await new Promise((r) => { link.onload = r; link.onerror = r; });
export {};

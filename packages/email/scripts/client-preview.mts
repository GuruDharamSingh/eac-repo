/**
 * The same letter, as three clients will actually draw it.
 *
 * The studio canvas is Chrome with the brand faces loaded. Most recipients get
 * neither, so "it looks right in the editor" is a claim about one renderer.
 */
import fs from "node:fs";
import { renderSample } from "../src/samples";

const html = await renderSample("rsvp-guest", { orgName: "Amrit Canada" });

// Apple Mail / iOS: keeps @font-face, keeps gradients. The studio's view.
fs.writeFileSync("/tmp/client-apple.html", html);

// Gmail / Yahoo: strips <style>, and with it every @font-face. The inline
// font-family declarations survive but resolve to the fallback stack.
fs.writeFileSync(
  "/tmp/client-gmail.html",
  html.replace(/<style[\s\S]*?<\/style>/gi, "")
);

// Outlook on Windows (Word). Three things, each mirroring what Word does:
//
//  1. ACTIVATE the conditional comments. A browser ignores them, so a naive
//     simulation shows the letter WITHOUT the fixed-width wrapper and looks
//     identical to the bug. Word is the only engine that reads them, so a
//     faithful simulation has to un-comment them.
//  2. Drop @font-face with the <style> block.
//  3. Drop gradients and max-width, neither of which Word supports.
fs.writeFileSync(
  "/tmp/client-outlook.html",
  html
    .replace(/<!--\[if mso\]>/g, "")
    .replace(/<!\[endif\]-->/g, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/background-image:\s*linear-gradient\([^;"]*;?/gi, "")
    .replace(/max-width:\s*\d+px/gi, "max-width:none")
);

console.log("wrote three client views");

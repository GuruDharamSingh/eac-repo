import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SHARED_ACCENTS } from "../src/site/shared-accents";
import { hexToHsl } from "../src/site/style";

const css = readFileSync(new URL("../src/site/shared-accents.css", import.meta.url), "utf8");
const get = (name: string) => css.match(new RegExp(`${name}:\s*([^;]+);`))?.[1].trim();
assert.equal(get("--eac-accent-bronze"), SHARED_ACCENTS.bronze.hsl);
assert.equal(get("--eac-accent-bronze-hex"), SHARED_ACCENTS.bronze.hex);
assert.equal(hexToHsl(SHARED_ACCENTS.bronze.hex), SHARED_ACCENTS.bronze.hsl, "hex and triplet name the same colour");
console.log("check-shared-accents: passed");

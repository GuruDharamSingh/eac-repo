import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = resolve("src/styles.css");
const destination = resolve("dist/styles.css");

try {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  console.log(`Copied ${source} -> ${destination}`);
} catch (error) {
  console.error("Failed to copy styles.css", error);
  process.exitCode = 1;
}

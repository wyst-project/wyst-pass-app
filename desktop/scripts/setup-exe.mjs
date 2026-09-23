import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const release = join(root, "..", "src-tauri", "target", "release");
const source = join(release, "wyst-pass.exe");
const outDir = join(release, "setup");
const target = join(outDir, "Wyst Pass Setup.exe");

if (!existsSync(source)) {
  console.error(`missing ${source}, run tauri build first`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
copyFileSync(source, target);
console.log(`${target} (${Math.round(statSync(target).size / 1024)} KB)`);
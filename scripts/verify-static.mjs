import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const htmlPath = join(root, "index.html");
const html = readFileSync(htmlPath, "utf8");
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
check(duplicates.length === 0, `Duplicate HTML ids: ${duplicates.join(", ")}`);

const requiredIds = [
  "yard",
  "canvas-fallback",
  "trace-ledger",
  "trace-scrubber",
  "research-mode",
  "play",
  "previous",
  "next",
  "route-list",
  "stage-title",
  "dataset-select",
  "block-lab",
  "evidence",
  "quiz",
  "sources",
];
requiredIds.forEach((id) => check(ids.includes(id), `Missing required #${id}`));

const localRefs = [...html.matchAll(/\b(?:src|href)=["']([^"'#?]+)(?:\?[^"']*)?["']/g)]
  .map((match) => match[1])
  .filter((value) => !/^(?:https?:|mailto:|data:|\/\/)/.test(value));
localRefs.forEach((value) => {
  const target = join(root, value.replace(/^\.\//, ""));
  check(existsSync(target) && statSync(target).isFile(), `Missing local asset: ${value}`);
});

const yardTag = html.match(/<canvas\b[^>]*\bid=["']yard["'][^>]*>/i)?.[0] || "";
const decorativeCanvas = /aria-hidden=["']true["']/i.test(yardTag);
const describedCanvas = /role=["']img["']/i.test(yardTag) && /aria-describedby=["']canvas-phase-summary["']/i.test(yardTag);
check(decorativeCanvas || describedCanvas, "Canvas must be hidden or linked to its semantic trace description");
check(/\bid=["']phase-live["'][^>]*aria-live=["']polite["']/i.test(html), "Missing polite phase live region");
check(/arXiv v2/i.test(html), "Missing visible arXiv v2 scope disclosure");

const jsDir = join(root, "js");
const jsFiles = readdirSync(jsDir).filter((file) => extname(file) === ".js").sort();
check(jsFiles.length > 0, "No JavaScript files found");
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", join(jsDir, file)], { encoding: "utf8" });
  check(result.status === 0, `${file} syntax error: ${(result.stderr || result.stdout).trim()}`);
}

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL ${failure}`));
  process.exit(1);
}

console.log(`PASS static integrity (${ids.length} ids, ${localRefs.length} local references, ${jsFiles.length} scripts)`);

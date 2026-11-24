#!/usr/bin/env node
// Build UpJump for direct Cloudflare Pages Git integration without Actions.
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
execFileSync(process.execPath, ["scripts/smoke.mjs"], { cwd: root, stdio: "inherit" });
execFileSync(process.execPath, ["scripts/build-crazygames.mjs","public/downloads"], { cwd: root, stdio: "inherit" });
const sha = String(process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || "");
const meta = {
  game: "UpJump",
  revision: /^[a-f0-9]{40}$/i.test(sha) ? sha : null,
  builtAt: new Date().toISOString(),
  distribution: "cloudflare-pages-git", portalZip: "downloads/upjump-crazygames.zip"
};
await writeFile(join(root, "public/release.json"), JSON.stringify(meta, null, 2) + "\n");
console.log("PASS: UpJump production files ready in public/");

#!/usr/bin/env node
/**
 * Wrapper around the Convex CLI for Cloudflare Pages preview builds.
 * Preview environments often omit CONVEX_DEPLOY_KEY; in that case `convex deploy`
 * fails before `--cmd` runs. When that happens, run the build command only.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realConvexMain = path.join(rootDir, "node_modules", "convex", "bin", "main.js");
const args = process.argv.slice(2);

function runRealConvex() {
  const result = spawnSync(process.execPath, [realConvexMain, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

const isDeploy = args[0] === "deploy";
const isCloudflare = Boolean(process.env.CF_PAGES);
const hasDeployKey = Boolean(process.env.CONVEX_DEPLOY_KEY);
const isMainBranch = process.env.CF_PAGES_BRANCH === "main";

function isPreviewDeployKey(adminKey) {
  const parts = adminKey.split("|");
  if (parts.length === 1) {
    return false;
  }
  const prefixParts = parts[0].split(":");
  return prefixParts[0] === "preview" && prefixParts.length === 3;
}

function runFrontendBuildOnly(reason) {
  const cmdIndex = args.indexOf("--cmd");
  const buildCmd = cmdIndex >= 0 ? args[cmdIndex + 1] : undefined;

  if (!buildCmd) {
    console.error(
      "[convex-bin-shim] Cloudflare preview build is missing CONVEX_DEPLOY_KEY and --cmd.",
    );
    process.exit(1);
  }

  console.warn(`[convex-bin-shim] ${reason}`);
  const result = spawnSync(buildCmd, {
    shell: true,
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

if (isDeploy && isCloudflare && !isMainBranch) {
  if (!hasDeployKey) {
    runFrontendBuildOnly(
      "Cloudflare preview build has no CONVEX_DEPLOY_KEY; running frontend build only.",
    );
  }

  if (!isPreviewDeployKey(process.env.CONVEX_DEPLOY_KEY ?? "")) {
    runFrontendBuildOnly(
      "Cloudflare preview build has a production deploy key; running frontend build only. Use a Preview Deploy Key for full-stack preview deploys.",
    );
  }
}

if (isDeploy && isCloudflare && !hasDeployKey) {
  runFrontendBuildOnly(
    "Cloudflare build has no CONVEX_DEPLOY_KEY; running frontend build only.",
  );
}

runRealConvex();

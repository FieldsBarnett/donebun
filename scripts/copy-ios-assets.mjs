#!/usr/bin/env node
/**
 * Copy Vite dist output into the Xcode project's assets folder.
 * Tauri iOS links libapp.a paths like /assets/index-*.js to this directory.
 */
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const assets = join(root, "src-tauri/gen/apple/assets");

mkdirSync(assets, { recursive: true });
for (const entry of ["index.html", "assets", "sqljs", "favicon.png", "icon.svg"]) {
  const src = join(dist, entry);
  const dest = join(assets, entry);
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
}

console.log(`Copied ${dist} -> ${assets}`);

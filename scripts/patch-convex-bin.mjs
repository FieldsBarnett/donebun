#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const binPath = path.join(rootDir, "node_modules", ".bin", "convex");
const shimPath = path.join(rootDir, "scripts", "convex-bin-shim.mjs");
const realMainPath = path.join(rootDir, "node_modules", "convex", "bin", "main.js");

if (!fs.existsSync(shimPath) || !fs.existsSync(realMainPath)) {
  process.exit(0);
}

const launcher = `#!/usr/bin/env node
import ${JSON.stringify(shimPath)};
`;

try {
  if (fs.lstatSync(binPath).isSymbolicLink()) {
    fs.unlinkSync(binPath);
  }
} catch {
  // .bin/convex may not exist yet on a fresh install.
}

fs.writeFileSync(binPath, launcher);
fs.chmodSync(binPath, 0o755);

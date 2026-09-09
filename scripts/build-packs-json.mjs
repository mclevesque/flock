/**
 * Dump the boards to JSON, for tools that should not have to parse TypeScript.
 *
 * The portrait backfill needs the entry list for a board that has been written
 * but not yet deployed — see `--packs=` in draftmasters-backfill-portraits.mjs.
 * Kept as a build step rather than a runtime import so the script stays plain
 * Node with no toolchain of its own.
 *
 *   node scripts/build-packs-json.mjs > packs.json
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "dm-packs-"));
const out = join(dir, "packs.mjs");
try {
  // The binary directly, not npx: on Windows a .cmd shim cannot be spawned
  // without a shell, and shelling out to pass a temp path is worse.
  const esbuild = join(
    "node_modules", "@esbuild",
    process.platform === "win32" ? "win32-x64" : `${process.platform}-x64`,
    process.platform === "win32" ? "esbuild.exe" : "bin/esbuild"
  );
  execFileSync(
    esbuild,
    ["lib/draftmasters/packs.ts", "--bundle", "--platform=node", "--format=esm",
     `--outfile=${out}`, "--log-level=error"],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  const { PACKS } = await import(pathToFileURL(out).href);
  process.stdout.write(JSON.stringify(PACKS));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

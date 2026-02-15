import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { KnowledgeScope } from "./types.js";

const GLOBAL_DIR = join(homedir(), ".distill", "knowledge");
const PROJECT_SUBDIR = ".distill";

/** Resolve the storage directory for a given scope */
export function resolveStorePath(
  scope: KnowledgeScope,
  projectRoot?: string
): string {
  if (scope === "global") {
    ensureDir(GLOBAL_DIR);
    return GLOBAL_DIR;
  }

  if (!projectRoot) {
    throw new Error("project scope requires projectRoot");
  }

  const dir = join(projectRoot, PROJECT_SUBDIR, "knowledge");
  ensureDir(dir);
  return dir;
}

/** Get the SQLite database path for a scope */
export function resolveDbPath(
  scope: KnowledgeScope,
  projectRoot?: string
): string {
  const base = resolveStorePath(scope, projectRoot);
  return join(base, "metadata.db");
}

/** Detect project root from CWD by looking for common markers */
export function detectProjectRoot(cwd?: string): string | null {
  const dir = cwd ?? process.cwd();
  const markers = [".git", "pubspec.yaml", "package.json", "CLAUDE.md"];

  for (const marker of markers) {
    if (existsSync(join(dir, marker))) {
      return dir;
    }
  }
  return null;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

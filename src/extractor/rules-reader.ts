import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * Read all existing distill-*.md rule files from both global and project scopes.
 * Returns concatenated content, or undefined if no rules exist.
 */
export function readExistingDistillRules(
  projectRoot?: string | null,
): string | undefined {
  const parts: string[] = [];

  // Global rules
  const globalDir = join(homedir(), ".claude", "rules");
  parts.push(...readDistillFiles(globalDir));

  // Project rules
  if (projectRoot) {
    const projectDir = join(projectRoot, ".claude", "rules");
    parts.push(...readDistillFiles(projectDir));
  }

  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

function readDistillFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter(
    (f) => f.startsWith("distill-") && f.endsWith(".md"),
  );

  return files.map((f) => {
    const content = readFileSync(join(dir, f), "utf-8");
    return `### ${f}\n${content}`;
  });
}

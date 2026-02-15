import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/** Distill configuration */
export interface DistillConfig {
  /** Model for knowledge extraction (learn) */
  extraction_model: string;
  /** Model for crystallize (rule generation) */
  crystallize_model: string;
  /** Max transcript characters to send to LLM */
  max_transcript_chars: number;
  /** Auto-crystallize after N new chunks (0 = disabled) */
  auto_crystallize_threshold: number;
}

const DEFAULTS: DistillConfig = {
  extraction_model: "claude-haiku-4-5-20251001",
  crystallize_model: "claude-sonnet-4-5-20250929",
  max_transcript_chars: 100_000,
  auto_crystallize_threshold: 0,
};

function loadJsonFile(path: string): Partial<DistillConfig> {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as Partial<DistillConfig>;
  } catch {
    return {};
  }
}

/**
 * Load config with priority: project > global > defaults.
 * Missing fields fall back to the next level.
 */
export function loadConfig(projectRoot?: string | null): DistillConfig {
  const globalPath = join(homedir(), ".distill", "config.json");
  const globalConf = loadJsonFile(globalPath);

  let projectConf: Partial<DistillConfig> = {};
  if (projectRoot) {
    const projectPath = join(projectRoot, ".distill", "config.json");
    projectConf = loadJsonFile(projectPath);
  }

  return { ...DEFAULTS, ...globalConf, ...projectConf };
}

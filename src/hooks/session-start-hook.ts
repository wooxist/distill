#!/usr/bin/env node

/**
 * Distill SessionStart hook.
 *
 * Checks for a pending-learn.json file written by the PreCompact/SessionEnd
 * hook. If found (and not stale), returns additionalContext so Claude Code
 * automatically sees the learn prompt at session start.
 *
 * Usage in .claude/settings.json:
 *   "hooks": {
 *     "SessionStart": [{ "command": "node build/hooks/session-start-hook.js" }]
 *   }
 *
 * Output format (JSON to stdout):
 *   { "additionalContext": "[Distill] ..." }
 *
 * If no pending extraction exists, outputs nothing (exit 0).
 */

import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { PENDING_LEARN_PATH } from "./pending-learn.js";
import type { PendingLearn } from "./pending-learn.js";

/** Maximum age of a pending-learn file before it's considered stale (24 hours) */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function main() {
  if (!existsSync(PENDING_LEARN_PATH)) {
    // No pending extraction — nothing to do
    process.exit(0);
  }

  let pending: PendingLearn;
  try {
    const raw = readFileSync(PENDING_LEARN_PATH, "utf-8");
    pending = JSON.parse(raw);
  } catch {
    // Malformed file — clean up and exit silently
    tryDelete(PENDING_LEARN_PATH);
    process.exit(0);
  }

  // Validate required fields
  if (!pending.session_id || !pending.transcript_path) {
    tryDelete(PENDING_LEARN_PATH);
    process.exit(0);
  }

  // Check staleness
  if (pending.timestamp) {
    const age = Date.now() - new Date(pending.timestamp).getTime();
    if (age > MAX_AGE_MS) {
      console.error("distill-session-start: pending-learn.json is stale, ignoring");
      tryDelete(PENDING_LEARN_PATH);
      process.exit(0);
    }
  }

  // Delete pending file before outputting (consume once)
  tryDelete(PENDING_LEARN_PATH);

  const context = [
    "[Distill] Previous session has unprocessed knowledge.",
    `Please run the \`learn\` tool to extract knowledge from the previous session.`,
    `transcript_path: ${pending.transcript_path}`,
    `session_id: ${pending.session_id}`,
  ].join("\n");

  const output = JSON.stringify({ additionalContext: context });
  process.stdout.write(output);
}

function tryDelete(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // Ignore — file may already be gone
  }
}

main().catch((err) => {
  console.error(`distill-session-start: fatal error: ${err}`);
  // Always exit 0 — never block session start
  process.exit(0);
});

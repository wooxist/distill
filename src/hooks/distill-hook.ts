#!/usr/bin/env node

/**
 * Distill hook handler for PreCompact and SessionEnd events.
 *
 * Since extraction uses MCP sampling (server.createMessage),
 * the hook cannot perform extraction directly — it runs outside
 * the MCP server process. Instead, it:
 *   1. Writes a pending-learn.json file so the SessionStart hook can
 *      inject learn context into the next session automatically.
 *   2. Outputs a prompt to stdout for Claude Code to call `learn`.
 *
 * Usage in .claude/settings.json:
 *   "hooks": {
 *     "PreCompact": [{ "command": "node build/hooks/distill-hook.js" }],
 *     "SessionEnd": [{ "command": "node build/hooks/distill-hook.js" }]
 *   }
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { PENDING_LEARN_PATH } from "./pending-learn.js";
import type { PendingLearn } from "./pending-learn.js";

interface HookInput {
  session_id: string;
  transcript_path: string;
  cwd?: string;
  hook_event_name?: string;
}

async function main() {
  // Read stdin
  const input = await readStdin();
  if (!input) {
    console.error("distill-hook: no input received on stdin");
    process.exit(1);
  }

  let hookData: HookInput;
  try {
    hookData = JSON.parse(input);
  } catch {
    console.error("distill-hook: invalid JSON on stdin");
    process.exit(1);
  }

  if (!hookData.session_id || !hookData.transcript_path) {
    console.error(
      "distill-hook: missing session_id or transcript_path"
    );
    process.exit(1);
  }

  const event = hookData.hook_event_name ?? "unknown";

  // Write pending-learn.json for SessionStart hook to pick up
  try {
    const pendingDir = join(homedir(), ".distill");
    mkdirSync(pendingDir, { recursive: true });
    const pending: PendingLearn = {
      session_id: hookData.session_id,
      transcript_path: hookData.transcript_path,
      event,
      timestamp: new Date().toISOString(),
    };
    writeFileSync(PENDING_LEARN_PATH, JSON.stringify(pending, null, 2));
  } catch (err) {
    // Non-fatal — still output prompt to stdout
    console.error(`distill-hook: failed to write pending-learn.json: ${err}`);
  }

  console.error(
    `distill-hook: ${event} event — requesting learn for session ${hookData.session_id}`
  );

  // stdout: Claude Code will see this and can act on it
  const message = [
    `[Distill] ${event} event detected.`,
    `Please run the \`learn\` tool to extract knowledge from this session.`,
    `transcript_path: ${hookData.transcript_path}`,
    `session_id: ${hookData.session_id}`,
  ].join("\n");

  process.stdout.write(message);
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data.trim()));

    // Timeout after 5 seconds if no stdin
    setTimeout(() => resolve(data.trim()), 5000);
  });
}

main().catch((err) => {
  console.error(`distill-hook: fatal error: ${err}`);
  process.exit(1);
});

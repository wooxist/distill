import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import type { PendingLearn } from "../src/hooks/pending-learn.ts";

const HOOK_SCRIPT = join(import.meta.dirname, "..", "src", "hooks", "session-start-hook.ts");
const PENDING_PATH = join(homedir(), ".distill", "pending-learn.json");

function runSessionStartHook(): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("node", ["--import", "tsx/esm", HOOK_SCRIPT], {
    encoding: "utf-8",
    timeout: 10_000,
  });

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

function writePendingFile(overrides: Partial<PendingLearn> = {}): void {
  mkdirSync(join(homedir(), ".distill"), { recursive: true });
  const pending: PendingLearn = {
    session_id: "sess-prev-001",
    transcript_path: "/tmp/prev-transcript.jsonl",
    event: "PreCompact",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
  writeFileSync(PENDING_PATH, JSON.stringify(pending));
}

describe("session-start-hook", () => {
  beforeEach(() => {
    // Ensure clean state
    try { unlinkSync(PENDING_PATH); } catch { /* ignore */ }
  });

  afterEach(() => {
    try { unlinkSync(PENDING_PATH); } catch { /* ignore */ }
  });

  it("returns additionalContext when pending file exists", () => {
    writePendingFile();
    const { stdout, exitCode } = runSessionStartHook();

    assert.equal(exitCode, 0);
    const output = JSON.parse(stdout);
    assert.ok(output.additionalContext);
    assert.ok(output.additionalContext.includes("[Distill]"));
    assert.ok(output.additionalContext.includes("learn"));
    assert.ok(output.additionalContext.includes("sess-prev-001"));
    assert.ok(output.additionalContext.includes("/tmp/prev-transcript.jsonl"));
  });

  it("deletes pending file after reading", () => {
    writePendingFile();
    assert.ok(existsSync(PENDING_PATH));

    runSessionStartHook();

    assert.ok(!existsSync(PENDING_PATH), "pending file should be deleted after reading");
  });

  it("returns empty output when no pending file exists", () => {
    const { stdout, exitCode } = runSessionStartHook();

    assert.equal(exitCode, 0);
    assert.equal(stdout.trim(), "");
  });

  it("ignores stale pending file (> 24h)", () => {
    const staleTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    writePendingFile({ timestamp: staleTimestamp });

    const { stdout, exitCode } = runSessionStartHook();

    assert.equal(exitCode, 0);
    assert.equal(stdout.trim(), "");
    assert.ok(!existsSync(PENDING_PATH), "stale file should be cleaned up");
  });

  it("handles malformed pending file gracefully", () => {
    mkdirSync(join(homedir(), ".distill"), { recursive: true });
    writeFileSync(PENDING_PATH, "not-valid-json{{{");

    const { stdout, exitCode } = runSessionStartHook();

    assert.equal(exitCode, 0);
    assert.equal(stdout.trim(), "");
    assert.ok(!existsSync(PENDING_PATH), "malformed file should be cleaned up");
  });

  it("always exits with code 0", () => {
    // Even with no file
    const { exitCode: exitNoFile } = runSessionStartHook();
    assert.equal(exitNoFile, 0);

    // Even with malformed file
    mkdirSync(join(homedir(), ".distill"), { recursive: true });
    writeFileSync(PENDING_PATH, "{bad json");
    const { exitCode: exitBadFile } = runSessionStartHook();
    assert.equal(exitBadFile, 0);
  });
});

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { existsSync, readFileSync, unlinkSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";

const HOOK_SCRIPT = join(import.meta.dirname, "..", "src", "hooks", "distill-hook.ts");

function runHook(
  stdinData: string,
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("node", ["--import", "tsx/esm", HOOK_SCRIPT], {
    input: stdinData,
    encoding: "utf-8",
    timeout: 10_000,
  });

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

describe("distill-hook", () => {
  const validInput = JSON.stringify({
    session_id: "sess-abc-123",
    transcript_path: "/tmp/test-transcript.jsonl",
    hook_event_name: "PreCompact",
  });

  it("outputs correct prompt message", () => {
    const { stdout } = runHook(validInput);

    assert.ok(stdout.includes("[Distill]"));
    assert.ok(stdout.includes("learn"));
  });

  it("includes session_id in output", () => {
    const { stdout } = runHook(validInput);

    assert.ok(stdout.includes("sess-abc-123"));
  });

  it("includes transcript_path in output", () => {
    const { stdout } = runHook(validInput);

    assert.ok(stdout.includes("/tmp/test-transcript.jsonl"));
  });

  it("includes hook_event_name in output", () => {
    const { stdout } = runHook(validInput);

    assert.ok(stdout.includes("PreCompact"));
  });

  it("defaults event to unknown when hook_event_name omitted", () => {
    const input = JSON.stringify({
      session_id: "sess-001",
      transcript_path: "/tmp/t.jsonl",
    });

    const { stdout } = runHook(input);

    assert.ok(stdout.includes("unknown"));
  });

  it("exits with code 1 on invalid JSON", () => {
    const { exitCode, stderr } = runHook("not-json");

    assert.equal(exitCode, 1);
    assert.ok(stderr.includes("distill-hook"));
  });

  it("exits with code 1 on missing session_id", () => {
    const input = JSON.stringify({
      transcript_path: "/tmp/t.jsonl",
    });

    const { exitCode, stderr } = runHook(input);

    assert.equal(exitCode, 1);
    assert.ok(stderr.includes("distill-hook"));
  });

  it("exits with code 1 on missing transcript_path", () => {
    const input = JSON.stringify({
      session_id: "sess-001",
    });

    const { exitCode, stderr } = runHook(input);

    assert.equal(exitCode, 1);
    assert.ok(stderr.includes("distill-hook"));
  });

  it("writes diagnostic to stderr", () => {
    const { stderr } = runHook(validInput);

    // The hook writes to stderr via console.error
    assert.ok(stderr.includes("distill-hook:"));
  });

  // --- pending-learn.json tests ---

  const pendingPath = join(homedir(), ".distill", "pending-learn.json");

  afterEach(() => {
    // Clean up pending file if created
    try { unlinkSync(pendingPath); } catch { /* ignore */ }
  });

  it("writes pending-learn.json on valid input", () => {
    mkdirSync(join(homedir(), ".distill"), { recursive: true });
    runHook(validInput);

    assert.ok(existsSync(pendingPath), "pending-learn.json should exist");
  });

  it("pending file contains session_id, transcript_path, event, timestamp", () => {
    mkdirSync(join(homedir(), ".distill"), { recursive: true });
    runHook(validInput);

    const pending = JSON.parse(readFileSync(pendingPath, "utf-8"));
    assert.equal(pending.session_id, "sess-abc-123");
    assert.equal(pending.transcript_path, "/tmp/test-transcript.jsonl");
    assert.equal(pending.event, "PreCompact");
    assert.ok(pending.timestamp, "timestamp should be present");
  });

  it("still outputs prompt to stdout when pending file is written", () => {
    mkdirSync(join(homedir(), ".distill"), { recursive: true });
    const { stdout } = runHook(validInput);

    assert.ok(stdout.includes("[Distill]"));
    assert.ok(existsSync(pendingPath));
  });
});

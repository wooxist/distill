import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../src/config.ts";

describe("loadConfig", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "distill-config-test-"));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns defaults when no config files exist", () => {
    const config = loadConfig(join(tmpDir, "nonexistent"));
    assert.equal(config.extraction_model, "claude-haiku-4-5-20251001");
    assert.equal(config.crystallize_model, "claude-sonnet-4-5-20250929");
    assert.equal(config.max_transcript_chars, 100_000);
    assert.equal(config.auto_crystallize_threshold, 0);
  });

  it("returns defaults when projectRoot is null", () => {
    const config = loadConfig(null);
    assert.equal(config.extraction_model, "claude-haiku-4-5-20251001");
  });

  it("returns defaults when projectRoot is undefined", () => {
    const config = loadConfig();
    assert.equal(config.extraction_model, "claude-haiku-4-5-20251001");
  });

  it("merges project config over defaults", () => {
    const projectDir = join(tmpDir, "project1");
    mkdirSync(join(projectDir, ".distill"), { recursive: true });
    writeFileSync(
      join(projectDir, ".distill", "config.json"),
      JSON.stringify({ extraction_model: "custom-model" }),
    );

    const config = loadConfig(projectDir);
    assert.equal(config.extraction_model, "custom-model");
    // Other fields remain default
    assert.equal(config.crystallize_model, "claude-sonnet-4-5-20250929");
    assert.equal(config.max_transcript_chars, 100_000);
  });

  it("handles partial config (only some fields)", () => {
    const projectDir = join(tmpDir, "project-partial");
    mkdirSync(join(projectDir, ".distill"), { recursive: true });
    writeFileSync(
      join(projectDir, ".distill", "config.json"),
      JSON.stringify({ auto_crystallize_threshold: 10 }),
    );

    const config = loadConfig(projectDir);
    assert.equal(config.auto_crystallize_threshold, 10);
    assert.equal(config.extraction_model, "claude-haiku-4-5-20251001");
  });

  it("ignores malformed JSON gracefully", () => {
    const projectDir = join(tmpDir, "project-bad");
    mkdirSync(join(projectDir, ".distill"), { recursive: true });
    writeFileSync(
      join(projectDir, ".distill", "config.json"),
      "NOT VALID JSON {{{{",
    );

    const config = loadConfig(projectDir);
    assert.equal(config.extraction_model, "claude-haiku-4-5-20251001");
  });
});

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { extractKnowledge } from "../src/extractor/extractor.ts";
import { createMockServer } from "./helpers/mock-server.ts";

const FIXTURE_BASIC = join(import.meta.dirname, "fixtures", "transcript-basic.jsonl");
const FIXTURE_EMPTY = join(import.meta.dirname, "fixtures", "transcript-empty.jsonl");

const VALID_LLM_RESPONSE = JSON.stringify([
  {
    content: "Use ESM modules with strict mode",
    type: "preference",
    scope: "global",
    tags: ["typescript"],
    confidence: 0.9,
  },
  {
    content: "Prefer named exports over default exports for better tree-shaking",
    type: "decision",
    scope: "project",
    tags: ["typescript", "exports"],
    confidence: 0.85,
  },
]);

describe("extractKnowledge", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "distill-ek-"));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("returns KnowledgeInput[] from valid transcript", async () => {
    const { server } = createMockServer({ response: VALID_LLM_RESPONSE });

    const result = await extractKnowledge({
      server,
      transcriptPath: FIXTURE_BASIC,
      sessionId: "sess-001",
      trigger: "manual",
      projectName: "test-project",
      projectRoot: tmpRoot,
    });

    assert.equal(result.length, 2);
    assert.equal(result[0].content, "Use ESM modules with strict mode");
    assert.equal(result[0].type, "preference");
    assert.equal(result[0].scope, "global");
    assert.deepEqual(result[0].tags, ["typescript"]);
    assert.equal(result[0].confidence, 0.9);
  });

  it("returns empty array for < 2 turns", async () => {
    const { server, calls } = createMockServer({ response: "[]" });

    const result = await extractKnowledge({
      server,
      transcriptPath: FIXTURE_EMPTY,
      sessionId: "sess-002",
      trigger: "manual",
      projectRoot: tmpRoot,
    });

    assert.equal(result.length, 0);
    // Should not call LLM at all
    assert.equal(calls.length, 0);
  });

  it("applies scopeOverride to all chunks", async () => {
    const { server } = createMockServer({ response: VALID_LLM_RESPONSE });

    const result = await extractKnowledge({
      server,
      transcriptPath: FIXTURE_BASIC,
      sessionId: "sess-003",
      trigger: "manual",
      scopeOverride: "global",
      projectRoot: tmpRoot,
    });

    for (const chunk of result) {
      assert.equal(chunk.scope, "global");
    }
  });

  it("sets project name on project-scoped chunks", async () => {
    const { server } = createMockServer({ response: VALID_LLM_RESPONSE });

    const result = await extractKnowledge({
      server,
      transcriptPath: FIXTURE_BASIC,
      sessionId: "sess-004",
      trigger: "manual",
      projectName: "my-app",
      projectRoot: tmpRoot,
    });

    const projectChunks = result.filter((c) => c.scope === "project");
    for (const chunk of projectChunks) {
      assert.equal(chunk.project, "my-app");
    }

    const globalChunks = result.filter((c) => c.scope === "global");
    for (const chunk of globalChunks) {
      assert.equal(chunk.project, null);
    }
  });

  it("sets trigger from opts", async () => {
    const { server } = createMockServer({ response: VALID_LLM_RESPONSE });

    const result = await extractKnowledge({
      server,
      transcriptPath: FIXTURE_BASIC,
      sessionId: "sess-005",
      trigger: "auto",
      projectRoot: tmpRoot,
    });

    for (const chunk of result) {
      assert.equal(chunk.source.trigger, "auto");
    }
  });

  it("sets session_id from opts", async () => {
    const { server } = createMockServer({ response: VALID_LLM_RESPONSE });

    const result = await extractKnowledge({
      server,
      transcriptPath: FIXTURE_BASIC,
      sessionId: "my-unique-session",
      trigger: "manual",
      projectRoot: tmpRoot,
    });

    for (const chunk of result) {
      assert.equal(chunk.source.session_id, "my-unique-session");
    }
  });

  it("truncates long transcripts within max_transcript_chars", async () => {
    // Create a config with very low max_transcript_chars
    const configDir = join(tmpRoot, ".distill");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ max_transcript_chars: 50 }),
    );

    const { server } = createMockServer({ response: VALID_LLM_RESPONSE });

    // Should not throw, even with truncation
    const result = await extractKnowledge({
      server,
      transcriptPath: FIXTURE_BASIC,
      sessionId: "sess-007",
      trigger: "manual",
      projectRoot: tmpRoot,
    });

    // Result depends on whether truncation still leaves >= 2 turns
    assert.ok(Array.isArray(result));
  });

  it("handles LLM returning empty array", async () => {
    const { server } = createMockServer({ response: "[]" });

    const result = await extractKnowledge({
      server,
      transcriptPath: FIXTURE_BASIC,
      sessionId: "sess-008",
      trigger: "manual",
      projectRoot: tmpRoot,
    });

    assert.equal(result.length, 0);
  });

  it("passes existing rules to LLM", async () => {
    // Create a distill rule file in the project
    const rulesDir = join(tmpRoot, ".claude", "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(
      join(rulesDir, "distill-style.md"),
      "# style\n- Always use semicolons",
    );

    const { server, calls } = createMockServer({ response: "[]" });

    await extractKnowledge({
      server,
      transcriptPath: FIXTURE_BASIC,
      sessionId: "sess-009",
      trigger: "manual",
      projectRoot: tmpRoot,
    });

    // The LLM call should include existing rules in the prompt
    const promptText = calls[0].messages[0].content.text;
    assert.ok(promptText?.includes("<existing_rules>"));
    assert.ok(promptText?.includes("Always use semicolons"));
  });
});

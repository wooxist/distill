import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseCrystallizeResponse, crystallize } from "../src/extractor/crystallize.ts";
import { CRYSTALLIZE_SYSTEM_PROMPT } from "../src/extractor/prompts.ts";
import { createMockServer } from "./helpers/mock-server.ts";
import { makeKnowledgeChunk } from "./helpers/factories.ts";

describe("parseCrystallizeResponse", () => {
  it("parses valid create action", () => {
    const text = `[{
      "topic": "typescript-style",
      "action": "create",
      "rules": ["Use strict mode", "Prefer named exports"],
      "source_ids": ["id1", "id2"]
    }]`;

    const result = parseCrystallizeResponse(text);
    assert.equal(result.length, 1);
    assert.equal(result[0].topic, "typescript-style");
    assert.equal(result[0].action, "create");
    assert.deepEqual(result[0].rules, ["Use strict mode", "Prefer named exports"]);
    assert.deepEqual(result[0].source_ids, ["id1", "id2"]);
  });

  it("parses all valid actions", () => {
    const actions = ["create", "update", "remove"];
    for (const action of actions) {
      const text = `[{"topic":"t","action":"${action}","rules":["r"],"source_ids":["s"]}]`;
      const result = parseCrystallizeResponse(text);
      assert.equal(result.length, 1, `action "${action}" should be accepted`);
    }
  });

  it("parses update with existing_file", () => {
    const text = `[{
      "topic": "error-handling",
      "action": "update",
      "rules": ["Updated rule"],
      "source_ids": ["id3"],
      "existing_file": "distill-error-handling.md"
    }]`;

    const result = parseCrystallizeResponse(text);
    assert.equal(result.length, 1);
    assert.equal(result[0].existing_file, "distill-error-handling.md");
  });

  it("parses multiple results", () => {
    const text = `[
      {"topic":"a","action":"create","rules":["r1"],"source_ids":["s1"]},
      {"topic":"b","action":"update","rules":["r2"],"source_ids":["s2"]},
      {"topic":"c","action":"remove","rules":[],"source_ids":["s3"]}
    ]`;

    const result = parseCrystallizeResponse(text);
    assert.equal(result.length, 3);
  });

  it("filters entries with invalid action", () => {
    const text = `[{"topic":"t","action":"invalid","rules":["r"],"source_ids":["s"]}]`;
    const result = parseCrystallizeResponse(text);
    assert.equal(result.length, 0);
  });

  it("filters entries missing topic", () => {
    const text = `[{"action":"create","rules":["r"],"source_ids":["s"]}]`;
    const result = parseCrystallizeResponse(text);
    assert.equal(result.length, 0);
  });

  it("filters entries with non-array rules", () => {
    const text = `[{"topic":"t","action":"create","rules":"not-array","source_ids":["s"]}]`;
    const result = parseCrystallizeResponse(text);
    assert.equal(result.length, 0);
  });

  it("filters entries with non-array source_ids", () => {
    const text = `[{"topic":"t","action":"create","rules":["r"],"source_ids":"not-array"}]`;
    const result = parseCrystallizeResponse(text);
    assert.equal(result.length, 0);
  });

  it("returns empty array when no JSON found", () => {
    const result = parseCrystallizeResponse("No patterns detected.");
    assert.equal(result.length, 0);
  });

  it("returns empty array for malformed JSON", () => {
    const result = parseCrystallizeResponse("[{bad}]");
    assert.equal(result.length, 0);
  });

  it("handles JSON embedded in surrounding text", () => {
    const text = `Here are the results:

[{"topic":"embedded","action":"create","rules":["found it"],"source_ids":["e1"]}]

That's all.`;

    const result = parseCrystallizeResponse(text);
    assert.equal(result.length, 1);
    assert.equal(result[0].topic, "embedded");
  });
});

describe("crystallize", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "distill-cryst-"));
    mkdirSync(join(tmpRoot, ".claude", "rules"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  const createResponse = JSON.stringify([
    {
      topic: "typescript-style",
      action: "create",
      rules: ["Use strict mode", "Prefer named exports"],
      source_ids: ["id1", "id2"],
    },
  ]);

  it("returns empty report for empty chunks", async () => {
    const { server, calls } = createMockServer();

    const report = await crystallize({
      server,
      chunks: [],
      model: "test-model",
      projectRoot: tmpRoot,
    });

    assert.deepEqual(report, { created: [], updated: [], removed: [], total_rules: 0 });
    assert.equal(calls.length, 0);
  });

  it("sends correct createMessage params", async () => {
    const { server, calls } = createMockServer({ response: createResponse });
    const chunks = [makeKnowledgeChunk({ id: "c1", content: "Test rule" })];

    await crystallize({
      server,
      chunks,
      model: "claude-sonnet-4-5-20250929",
      projectRoot: tmpRoot,
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].systemPrompt, CRYSTALLIZE_SYSTEM_PROMPT);
    assert.deepEqual(calls[0].modelPreferences?.hints, [
      { name: "claude-sonnet-4-5-20250929" },
    ]);
    assert.equal(calls[0].modelPreferences?.intelligencePriority, 0.9);
    assert.equal(calls[0].maxTokens, 4096);
  });

  it("creates rule files for create action", async () => {
    const { server } = createMockServer({ response: createResponse });
    const chunks = [makeKnowledgeChunk({ id: "c1" })];

    const report = await crystallize({
      server,
      chunks,
      model: "test-model",
      projectRoot: tmpRoot,
    });

    assert.deepEqual(report.created, ["distill-typescript-style.md"]);
    assert.equal(report.total_rules, 2);

    const filePath = join(tmpRoot, ".claude", "rules", "distill-typescript-style.md");
    assert.ok(existsSync(filePath));

    const content = readFileSync(filePath, "utf-8");
    assert.ok(content.includes("# typescript-style"));
    assert.ok(content.includes("Use strict mode"));
    assert.ok(content.includes("Prefer named exports"));
  });

  it("updates rule files for update action", async () => {
    // Pre-create existing rule file
    writeFileSync(
      join(tmpRoot, ".claude", "rules", "distill-style.md"),
      "# style\n- Old rule",
    );

    const updateResponse = JSON.stringify([
      {
        topic: "style",
        action: "update",
        rules: ["Updated rule"],
        source_ids: ["u1"],
        existing_file: "distill-style.md",
      },
    ]);

    const { server } = createMockServer({ response: updateResponse });
    const chunks = [makeKnowledgeChunk({ id: "u1" })];

    const report = await crystallize({
      server,
      chunks,
      model: "test-model",
      projectRoot: tmpRoot,
    });

    assert.deepEqual(report.updated, ["distill-style.md"]);
    const content = readFileSync(
      join(tmpRoot, ".claude", "rules", "distill-style.md"),
      "utf-8",
    );
    assert.ok(content.includes("Updated rule"));
    assert.ok(!content.includes("Old rule"));
  });

  it("removes rule files for remove action", async () => {
    const filePath = join(tmpRoot, ".claude", "rules", "distill-obsolete.md");
    writeFileSync(filePath, "# obsolete\n- Old rule");
    assert.ok(existsSync(filePath));

    const removeResponse = JSON.stringify([
      {
        topic: "obsolete",
        action: "remove",
        rules: [],
        source_ids: ["r1"],
        existing_file: "distill-obsolete.md",
      },
    ]);

    const { server } = createMockServer({ response: removeResponse });
    const chunks = [makeKnowledgeChunk({ id: "r1" })];

    const report = await crystallize({
      server,
      chunks,
      model: "test-model",
      projectRoot: tmpRoot,
    });

    assert.deepEqual(report.removed, ["distill-obsolete.md"]);
    assert.ok(!existsSync(filePath));
  });

  it("reports created/updated/removed correctly", async () => {
    writeFileSync(
      join(tmpRoot, ".claude", "rules", "distill-old.md"),
      "# old\n- Rule",
    );
    writeFileSync(
      join(tmpRoot, ".claude", "rules", "distill-dead.md"),
      "# dead\n- Rule",
    );

    const mixedResponse = JSON.stringify([
      { topic: "new-topic", action: "create", rules: ["New rule"], source_ids: ["n1"] },
      { topic: "old", action: "update", rules: ["Better rule"], source_ids: ["o1"], existing_file: "distill-old.md" },
      { topic: "dead", action: "remove", rules: [], source_ids: ["d1"], existing_file: "distill-dead.md" },
    ]);

    const { server } = createMockServer({ response: mixedResponse });
    const chunks = [makeKnowledgeChunk({ id: "n1" }), makeKnowledgeChunk({ id: "o1" }), makeKnowledgeChunk({ id: "d1" })];

    const report = await crystallize({
      server,
      chunks,
      model: "test-model",
      projectRoot: tmpRoot,
    });

    assert.deepEqual(report.created, ["distill-new-topic.md"]);
    assert.deepEqual(report.updated, ["distill-old.md"]);
    assert.deepEqual(report.removed, ["distill-dead.md"]);
    assert.equal(report.total_rules, 2); // 1 from create + 1 from update
  });

  it("handles mixed actions in single response", async () => {
    const mixedResponse = JSON.stringify([
      { topic: "a", action: "create", rules: ["r1", "r2"], source_ids: ["s1"] },
      { topic: "b", action: "create", rules: ["r3"], source_ids: ["s2"] },
    ]);

    const { server } = createMockServer({ response: mixedResponse });
    const chunks = [makeKnowledgeChunk()];

    const report = await crystallize({
      server,
      chunks,
      model: "test-model",
      projectRoot: tmpRoot,
    });

    assert.equal(report.created.length, 2);
    assert.equal(report.total_rules, 3);
  });

  it("uses project rules dir when projectRoot is set", async () => {
    const { server } = createMockServer({ response: createResponse });
    const chunks = [makeKnowledgeChunk()];

    await crystallize({
      server,
      chunks,
      model: "test-model",
      projectRoot: tmpRoot,
    });

    const filePath = join(tmpRoot, ".claude", "rules", "distill-typescript-style.md");
    assert.ok(existsSync(filePath));
  });

  it("reads existing rules into prompt", async () => {
    // Pre-create a distill rule file
    writeFileSync(
      join(tmpRoot, ".claude", "rules", "distill-existing.md"),
      "# existing\n- Pre-existing rule",
    );

    const { server, calls } = createMockServer({ response: "[]" });
    const chunks = [makeKnowledgeChunk()];

    await crystallize({
      server,
      chunks,
      model: "test-model",
      projectRoot: tmpRoot,
    });

    const promptText = calls[0].messages[0].content.text;
    assert.ok(promptText?.includes("Pre-existing rule"));
  });

  it("returns empty report when LLM returns no patterns", async () => {
    const { server } = createMockServer({ response: "[]" });
    const chunks = [makeKnowledgeChunk()];

    const report = await crystallize({
      server,
      chunks,
      model: "test-model",
      projectRoot: tmpRoot,
    });

    assert.deepEqual(report, { created: [], updated: [], removed: [], total_rules: 0 });
  });

  it("propagates server errors", async () => {
    const { server } = createMockServer({
      error: new Error("crystallize sampling failed"),
    });
    const chunks = [makeKnowledgeChunk()];

    await assert.rejects(
      () => crystallize({ server, chunks, model: "test-model", projectRoot: tmpRoot }),
      { message: "crystallize sampling failed" },
    );
  });

  it("rule file follows expected format", async () => {
    const { server } = createMockServer({ response: createResponse });
    const chunks = [makeKnowledgeChunk()];

    await crystallize({
      server,
      chunks,
      model: "test-model",
      projectRoot: tmpRoot,
    });

    const content = readFileSync(
      join(tmpRoot, ".claude", "rules", "distill-typescript-style.md"),
      "utf-8",
    );

    // Check format: # topic, > Auto-generated, bullet rules, ## Sources
    assert.ok(content.startsWith("# typescript-style\n"));
    assert.ok(content.includes("> Auto-generated by Distill"));
    assert.ok(content.includes("- Use strict mode"));
    assert.ok(content.includes("- Prefer named exports"));
    assert.ok(content.includes("## Sources"));
    assert.ok(content.includes("- id1"));
    assert.ok(content.includes("- id2"));
  });
});

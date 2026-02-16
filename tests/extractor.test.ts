import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseExtractionResponse, callLlm } from "../src/extractor/extractor.ts";
import { EXTRACTION_SYSTEM_PROMPT } from "../src/extractor/prompts.ts";
import { createMockServer } from "./helpers/mock-server.ts";

describe("callLlm", () => {
  const validResponse = JSON.stringify([
    {
      content: "Use ESM modules",
      type: "preference",
      scope: "global",
      tags: ["typescript"],
      confidence: 0.9,
    },
  ]);

  it("sends correct message structure", async () => {
    const { server, calls } = createMockServer({ response: validResponse });
    await callLlm(server, "test transcript", "test-model");

    assert.equal(calls.length, 1);
    assert.equal(calls[0].messages.length, 1);
    assert.equal(calls[0].messages[0].role, "user");
    assert.equal(calls[0].messages[0].content.type, "text");
    assert.ok(calls[0].messages[0].content.text?.includes("test transcript"));
  });

  it("sends system prompt", async () => {
    const { server, calls } = createMockServer({ response: validResponse });
    await callLlm(server, "transcript", "model");

    assert.equal(calls[0].systemPrompt, EXTRACTION_SYSTEM_PROMPT);
  });

  it("sends model hints", async () => {
    const { server, calls } = createMockServer({ response: validResponse });
    await callLlm(server, "transcript", "claude-haiku-4-5-20251001");

    assert.deepEqual(calls[0].modelPreferences?.hints, [
      { name: "claude-haiku-4-5-20251001" },
    ]);
  });

  it("sets cost and speed priority", async () => {
    const { server, calls } = createMockServer({ response: validResponse });
    await callLlm(server, "transcript", "model");

    assert.equal(calls[0].modelPreferences?.costPriority, 0.8);
    assert.equal(calls[0].modelPreferences?.speedPriority, 0.8);
  });

  it("sets maxTokens to 4096", async () => {
    const { server, calls } = createMockServer({ response: validResponse });
    await callLlm(server, "transcript", "model");

    assert.equal(calls[0].maxTokens, 4096);
  });

  it("returns parsed extractions", async () => {
    const { server } = createMockServer({ response: validResponse });
    const result = await callLlm(server, "transcript", "model");

    assert.equal(result.length, 1);
    assert.equal(result[0].content, "Use ESM modules");
    assert.equal(result[0].type, "preference");
    assert.equal(result[0].scope, "global");
  });

  it("returns empty on empty response", async () => {
    const { server } = createMockServer({ response: "" });
    const result = await callLlm(server, "transcript", "model");

    assert.equal(result.length, 0);
  });

  it("returns empty on non-JSON response", async () => {
    const { server } = createMockServer({
      response: "No knowledge found in this transcript.",
    });
    const result = await callLlm(server, "transcript", "model");

    assert.equal(result.length, 0);
  });

  it("propagates server errors", async () => {
    const { server } = createMockServer({
      error: new Error("sampling failed"),
    });

    await assert.rejects(
      () => callLlm(server, "transcript", "model"),
      { message: "sampling failed" },
    );
  });

  it("includes project name in prompt", async () => {
    const { server, calls } = createMockServer({ response: "[]" });
    await callLlm(server, "transcript", "model", "distill");

    assert.ok(calls[0].messages[0].content.text?.includes("distill"));
  });

  it("includes existing rules in prompt", async () => {
    const { server, calls } = createMockServer({ response: "[]" });
    await callLlm(server, "transcript", "model", undefined, "### distill-style.md\n- Use strict mode");

    assert.ok(calls[0].messages[0].content.text?.includes("<existing_rules>"));
    assert.ok(calls[0].messages[0].content.text?.includes("Use strict mode"));
  });
});

describe("parseExtractionResponse", () => {
  it("parses valid JSON array", () => {
    const text = `Here are the extracted items:
[{"content":"Use ESM modules","type":"preference","scope":"global","tags":["typescript"],"confidence":0.9}]`;

    const result = parseExtractionResponse(text);
    assert.equal(result.length, 1);
    assert.equal(result[0].content, "Use ESM modules");
    assert.equal(result[0].type, "preference");
    assert.equal(result[0].scope, "global");
    assert.deepEqual(result[0].tags, ["typescript"]);
    assert.equal(result[0].confidence, 0.9);
  });

  it("parses multiple entries", () => {
    const text = `[
      {"content":"A","type":"pattern","scope":"global","tags":[],"confidence":0.8},
      {"content":"B","type":"decision","scope":"project","tags":["test"],"confidence":0.7}
    ]`;

    const result = parseExtractionResponse(text);
    assert.equal(result.length, 2);
  });

  it("accepts all valid types", () => {
    const types = ["pattern", "preference", "decision", "mistake", "workaround", "conflict"];
    for (const type of types) {
      const text = `[{"content":"x","type":"${type}","scope":"global","tags":[],"confidence":0.5}]`;
      const result = parseExtractionResponse(text);
      assert.equal(result.length, 1, `type "${type}" should be accepted`);
    }
  });

  it("filters entries with invalid type", () => {
    const text = `[{"content":"x","type":"invalid_type","scope":"global","tags":[],"confidence":0.5}]`;
    const result = parseExtractionResponse(text);
    assert.equal(result.length, 0);
  });

  it("filters entries with invalid scope", () => {
    const text = `[{"content":"x","type":"pattern","scope":"unknown","tags":[],"confidence":0.5}]`;
    const result = parseExtractionResponse(text);
    assert.equal(result.length, 0);
  });

  it("filters entries with confidence > 1", () => {
    const text = `[{"content":"x","type":"pattern","scope":"global","tags":[],"confidence":1.5}]`;
    const result = parseExtractionResponse(text);
    assert.equal(result.length, 0);
  });

  it("filters entries with negative confidence", () => {
    const text = `[{"content":"x","type":"pattern","scope":"global","tags":[],"confidence":-0.1}]`;
    const result = parseExtractionResponse(text);
    assert.equal(result.length, 0);
  });

  it("filters entries missing content", () => {
    const text = `[{"type":"pattern","scope":"global","tags":[],"confidence":0.5}]`;
    const result = parseExtractionResponse(text);
    assert.equal(result.length, 0);
  });

  it("filters entries with non-array tags", () => {
    const text = `[{"content":"x","type":"pattern","scope":"global","tags":"not-array","confidence":0.5}]`;
    const result = parseExtractionResponse(text);
    assert.equal(result.length, 0);
  });

  it("returns empty array when no JSON found", () => {
    const result = parseExtractionResponse("No knowledge found in this conversation.");
    assert.equal(result.length, 0);
  });

  it("returns empty array for malformed JSON", () => {
    const result = parseExtractionResponse("[{broken json}]");
    assert.equal(result.length, 0);
  });

  it("keeps valid entries and filters invalid ones", () => {
    const text = `[
      {"content":"valid","type":"pattern","scope":"global","tags":[],"confidence":0.8},
      {"content":"bad type","type":"nonexistent","scope":"global","tags":[],"confidence":0.5},
      {"content":"also valid","type":"decision","scope":"project","tags":["test"],"confidence":0.6}
    ]`;

    const result = parseExtractionResponse(text);
    assert.equal(result.length, 2);
    assert.equal(result[0].content, "valid");
    assert.equal(result[1].content, "also valid");
  });
});

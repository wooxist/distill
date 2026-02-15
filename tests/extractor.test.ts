import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseExtractionResponse } from "../src/extractor/extractor.ts";

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

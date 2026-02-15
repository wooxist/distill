import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCrystallizeResponse } from "../src/extractor/crystallize.ts";

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

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { parseTranscript, formatTranscript } from "../src/extractor/parser.ts";

const FIXTURES = join(import.meta.dirname, "fixtures");

describe("parseTranscript", () => {
  it("parses basic user/assistant messages", () => {
    const turns = parseTranscript(join(FIXTURES, "transcript-basic.jsonl"));
    assert.equal(turns.length, 4);
    assert.equal(turns[0].role, "user");
    assert.equal(turns[1].role, "assistant");
    assert.ok(turns[0].text.includes("TypeScript"));
  });

  it("preserves timestamps", () => {
    const turns = parseTranscript(join(FIXTURES, "transcript-basic.jsonl"));
    assert.equal(turns[0].timestamp, "2024-01-01T00:00:00Z");
  });

  it("skips tool_use and thinking blocks, keeps text", () => {
    const turns = parseTranscript(join(FIXTURES, "transcript-tool-use.jsonl"));
    // user + 2 assistant messages (tool_use msg has text, thinking msg has text)
    assert.equal(turns.length, 3);
    // The assistant message with tool_use should only contain the text part
    assert.ok(turns[1].text.includes("Here is your config"));
    assert.ok(!turns[1].text.includes("read_file"));
    // The assistant message with thinking should only contain the text part
    assert.ok(turns[2].text.includes("port 3000"));
    assert.ok(!turns[2].text.includes("Let me analyze"));
  });

  it("skips malformed JSON lines gracefully", () => {
    const turns = parseTranscript(join(FIXTURES, "transcript-malformed.jsonl"));
    assert.equal(turns.length, 2); // only 2 valid lines
    assert.equal(turns[0].role, "user");
    assert.equal(turns[1].role, "assistant");
  });

  it("returns empty array for empty file", () => {
    const turns = parseTranscript(join(FIXTURES, "transcript-empty.jsonl"));
    assert.equal(turns.length, 0);
  });
});

describe("formatTranscript", () => {
  it("formats turns with role headers", () => {
    const formatted = formatTranscript([
      { role: "user", text: "Hello" },
      { role: "assistant", text: "Hi there" },
    ]);

    assert.ok(formatted.includes("[USER]"));
    assert.ok(formatted.includes("[ASSISTANT]"));
    assert.ok(formatted.includes("Hello"));
    assert.ok(formatted.includes("Hi there"));
    assert.ok(formatted.includes("---"));
  });

  it("returns empty string for empty turns", () => {
    const formatted = formatTranscript([]);
    assert.equal(formatted, "");
  });
});

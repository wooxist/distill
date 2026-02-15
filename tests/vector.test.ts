import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { VectorStore, sanitizeFtsQuery } from "../src/store/vector.ts";

describe("sanitizeFtsQuery", () => {
  it("strips special characters", () => {
    const result = sanitizeFtsQuery("hello! world@#$");
    assert.ok(result.includes("hello"));
    assert.ok(result.includes("world"));
    assert.ok(!result.includes("!"));
    assert.ok(!result.includes("@"));
  });

  it("returns empty string for empty input", () => {
    assert.equal(sanitizeFtsQuery(""), "");
    assert.equal(sanitizeFtsQuery("   "), "");
  });

  it("joins tokens with OR", () => {
    const result = sanitizeFtsQuery("typescript config");
    assert.ok(result.includes("OR"));
    assert.ok(result.includes('"typescript"'));
    assert.ok(result.includes('"config"'));
  });

  it("handles unicode characters", () => {
    const result = sanitizeFtsQuery("한글 테스트");
    assert.ok(result.includes("한글"));
    assert.ok(result.includes("테스트"));
  });
});

describe("VectorStore", () => {
  let store: VectorStore;
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "distill-vec-test-"));
    store = new VectorStore("project", tmpDir);
  });

  after(() => {
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("indexes and searches content", () => {
    store.index("v1", "TypeScript strict mode is recommended", ["typescript"]);
    store.index("v2", "Python virtual environments are useful", ["python"]);

    const results = store.search("TypeScript");
    assert.ok(results.length > 0);
    assert.equal(results[0].id, "v1");
    assert.ok(results[0].score > 0);
  });

  it("returns empty array for no matches", () => {
    const results = store.search("nonexistentkeywordxyz");
    assert.equal(results.length, 0);
  });

  it("returns empty array for empty query", () => {
    const results = store.search("");
    assert.equal(results.length, 0);
  });

  it("removes entries from index", () => {
    store.index("v-remove", "Removable content for testing", ["test"]);
    const before = store.search("Removable");
    assert.ok(before.length > 0);

    store.remove("v-remove");
    const afterRemove = store.search("Removable");
    assert.equal(afterRemove.length, 0);
  });

  it("respects limit parameter", () => {
    store.index("v-lim1", "limit test alpha content", ["limit"]);
    store.index("v-lim2", "limit test beta content", ["limit"]);
    store.index("v-lim3", "limit test gamma content", ["limit"]);

    const results = store.search("limit test", 2);
    assert.ok(results.length <= 2);
  });

  it("splits tags into array on retrieval", () => {
    store.index("v-tags", "Tags test content", ["typescript", "config"]);
    const results = store.search("Tags test");
    assert.ok(results.length > 0);
    assert.ok(Array.isArray(results[0].tags));
  });
});

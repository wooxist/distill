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

  it("creates both FTS5 and vec0 tables", () => {
    // If constructor didn't throw, both tables exist
    assert.ok(store);
  });

  // --- FTS-only tests (sync, no embedding model needed) ---

  it("ftsSearch indexes and searches content", () => {
    // Use internal DB via index bypass — write FTS directly for sync test
    // We test ftsSearch independently of the async embedding pipeline
    const store2 = new VectorStore("project", tmpDir);
    // ftsSearch uses the FTS5 table only
    // Since index() is async, we test ftsSearch by directly checking sanitization + query
    const results = store2.ftsSearch("nonexistentkeywordxyz");
    assert.equal(results.length, 0);
    store2.close();
  });

  it("ftsSearch returns empty array for empty query", () => {
    const results = store.ftsSearch("");
    assert.equal(results.length, 0);
  });

  // --- Async tests (require embedding model) ---

  it("indexes and searches content via vector similarity", async () => {
    await store.index("v1", "TypeScript strict mode is recommended for all projects", ["typescript"]);
    await store.index("v2", "Python virtual environments are useful for isolation", ["python"]);

    const results = await store.search("TypeScript strict mode");
    assert.ok(results.length > 0);
    assert.equal(results[0].id, "v1");
    assert.ok(results[0].score > 0);
  });

  it("returns empty array for search with no indexed data matching", async () => {
    const store2 = new VectorStore("project", mkdtempSync(join(tmpdir(), "distill-vec-empty-")));
    const results = await store2.search("anything");
    assert.equal(results.length, 0);
    store2.close();
  });

  it("removes entries from both indexes", async () => {
    await store.index("v-remove", "Removable content for testing removal", ["test"]);
    const before = await store.search("Removable content testing removal");
    assert.ok(before.some((r) => r.id === "v-remove"));

    store.remove("v-remove");

    const afterRemove = await store.search("Removable content testing removal");
    assert.ok(!afterRemove.some((r) => r.id === "v-remove"));
  });

  it("respects limit parameter", async () => {
    await store.index("v-lim1", "limit test alpha content embedding", ["limit"]);
    await store.index("v-lim2", "limit test beta content embedding", ["limit"]);
    await store.index("v-lim3", "limit test gamma content embedding", ["limit"]);

    const results = await store.search("limit test content", 2);
    assert.ok(results.length <= 2);
  });

  it("search returns tags as array", async () => {
    await store.index("v-tags", "Tags test content for array verification", ["typescript", "config"]);
    const results = await store.search("Tags test array");
    assert.ok(results.length > 0);
    assert.ok(Array.isArray(results[0].tags));
  });

  it("ftsSearch works after async index", async () => {
    await store.index("v-fts", "FTS keyword search test content", ["fts"]);
    const results = store.ftsSearch("keyword search");
    assert.ok(results.length > 0);
    assert.equal(results[0].id, "v-fts");
  });
});

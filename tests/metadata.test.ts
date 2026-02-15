import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MetadataStore } from "../src/store/metadata.ts";
import { makeKnowledgeInput } from "./helpers/factories.ts";

describe("MetadataStore", () => {
  let store: MetadataStore;
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "distill-meta-test-"));
    store = new MetadataStore("project", tmpDir);
  });

  after(() => {
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("insert", () => {
    it("generates UUID and timestamps", () => {
      const input = makeKnowledgeInput({ content: "test insert" });
      const chunk = store.insert(input);

      assert.ok(chunk.id, "should have an id");
      assert.ok(chunk.created_at, "should have created_at");
      assert.ok(chunk.updated_at, "should have updated_at");
      assert.equal(chunk.access_count, 0);
      assert.equal(chunk.content, "test insert");
    });

    it("stores and retrieves tags as array", () => {
      const input = makeKnowledgeInput({ tags: ["typescript", "config"] });
      const chunk = store.insert(input);
      const retrieved = store.getById(chunk.id);

      assert.deepEqual(retrieved?.tags, ["typescript", "config"]);
    });
  });

  describe("getById", () => {
    it("returns chunk for existing ID", () => {
      const input = makeKnowledgeInput({ content: "findable" });
      const chunk = store.insert(input);
      const found = store.getById(chunk.id);

      assert.equal(found?.content, "findable");
      assert.equal(found?.type, "pattern");
    });

    it("returns null for non-existent ID", () => {
      const found = store.getById("non-existent-id");
      assert.equal(found, null);
    });
  });

  describe("search", () => {
    it("filters by type", () => {
      store.insert(makeKnowledgeInput({ content: "search-type-pref", type: "preference" }));
      store.insert(makeKnowledgeInput({ content: "search-type-dec", type: "decision" }));

      const prefs = store.search({ type: "preference" });
      assert.ok(prefs.every((c) => c.type === "preference"));
    });

    it("respects limit", () => {
      const results = store.search({ limit: 2 });
      assert.ok(results.length <= 2);
    });
  });

  describe("touch", () => {
    it("increments access_count", () => {
      const chunk = store.insert(makeKnowledgeInput({ content: "touchable" }));
      assert.equal(chunk.access_count, 0);

      store.touch(chunk.id);
      const updated = store.getById(chunk.id);
      assert.equal(updated?.access_count, 1);

      store.touch(chunk.id);
      const updated2 = store.getById(chunk.id);
      assert.equal(updated2?.access_count, 2);
    });
  });

  describe("delete", () => {
    it("returns true for existing entry", () => {
      const chunk = store.insert(makeKnowledgeInput({ content: "deletable" }));
      const result = store.delete(chunk.id);
      assert.equal(result, true);
      assert.equal(store.getById(chunk.id), null);
    });

    it("returns false for non-existent entry", () => {
      const result = store.delete("non-existent");
      assert.equal(result, false);
    });
  });

  describe("stats", () => {
    it("returns totals and breakdowns", () => {
      const s = store.stats();
      assert.ok(typeof s.total === "number");
      assert.ok(typeof s.byType === "object");
      assert.ok(typeof s.byScope === "object");
    });
  });

  describe("getAll", () => {
    it("returns all entries", () => {
      const all = store.getAll();
      assert.ok(Array.isArray(all));
      assert.ok(all.length > 0);
    });
  });

  describe("countSince", () => {
    it("counts entries after timestamp", () => {
      const past = "2000-01-01T00:00:00.000Z";
      const count = store.countSince(past);
      assert.ok(count > 0);

      const future = "2099-01-01T00:00:00.000Z";
      const countFuture = store.countSince(future);
      assert.equal(countFuture, 0);
    });
  });

  describe("getMeta / setMeta", () => {
    it("returns null for non-existent key", () => {
      assert.equal(store.getMeta("nonexistent_key"), null);
    });

    it("stores and retrieves value", () => {
      store.setMeta("test_key", "test_value");
      assert.equal(store.getMeta("test_key"), "test_value");
    });

    it("upserts on duplicate key", () => {
      store.setMeta("upsert_key", "first");
      store.setMeta("upsert_key", "second");
      assert.equal(store.getMeta("upsert_key"), "second");
    });
  });
});

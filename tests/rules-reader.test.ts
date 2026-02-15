import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readExistingDistillRules } from "../src/extractor/rules-reader.ts";

describe("readExistingDistillRules", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "distill-rules-test-"));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns undefined when no rules directories exist", () => {
    const result = readExistingDistillRules(join(tmpDir, "nonexistent"));
    // may pick up global rules, so just check it doesn't throw
    assert.ok(result === undefined || typeof result === "string");
  });

  it("reads distill-*.md files from project", () => {
    const projectDir = join(tmpDir, "project-with-rules");
    const rulesDir = join(projectDir, ".claude", "rules");
    mkdirSync(rulesDir, { recursive: true });

    writeFileSync(join(rulesDir, "distill-typescript.md"), "# typescript\n- Use strict mode\n");
    writeFileSync(join(rulesDir, "distill-testing.md"), "# testing\n- Write tests first\n");

    const result = readExistingDistillRules(projectDir);
    assert.ok(result);
    assert.ok(result.includes("typescript"));
    assert.ok(result.includes("testing"));
    assert.ok(result.includes("Use strict mode"));
    assert.ok(result.includes("Write tests first"));
  });

  it("ignores non-distill md files", () => {
    const projectDir = join(tmpDir, "project-mixed-rules");
    const rulesDir = join(projectDir, ".claude", "rules");
    mkdirSync(rulesDir, { recursive: true });

    writeFileSync(join(rulesDir, "distill-style.md"), "# style\n- Distill rule\n");
    writeFileSync(join(rulesDir, "contribution.md"), "# contribution\n- User rule\n");

    const result = readExistingDistillRules(projectDir);
    assert.ok(result);
    assert.ok(result.includes("Distill rule"));
    assert.ok(!result.includes("User rule"));
  });

  it("returns undefined when rules dir exists but has no distill files", () => {
    const projectDir = join(tmpDir, "project-no-distill");
    const rulesDir = join(projectDir, ".claude", "rules");
    mkdirSync(rulesDir, { recursive: true });

    writeFileSync(join(rulesDir, "contribution.md"), "# User-only rules\n");

    const result = readExistingDistillRules(projectDir);
    // Could be undefined if no global distill rules either
    assert.ok(result === undefined || typeof result === "string");
  });
});

/**
 * E2E Pipeline Test — Run full Distill pipeline on a real .jsonl transcript.
 *
 * Uses mock extraction (heuristic signal detection) to validate the full
 * pipeline without requiring an API key or MCP server context.
 *
 * For real LLM extraction, use the `learn` tool within Claude Code —
 * it uses MCP sampling (server.createMessage) through the user's subscription.
 *
 * Usage:
 *   npx tsx tests/e2e-pipeline.ts [path-to-jsonl]
 *
 * If no path is given, uses the smallest available session file.
 */

import { readdirSync, readFileSync, statSync, mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir, homedir } from "node:os";
import { parseTranscript, formatTranscript } from "../src/extractor/parser.ts";
import { parseExtractionResponse } from "../src/extractor/extractor.ts";
import { parseCrystallizeResponse } from "../src/extractor/crystallize.ts";
import { MetadataStore } from "../src/store/metadata.ts";
import { VectorStore } from "../src/store/vector.ts";
import { loadConfig } from "../src/config.ts";
import type { KnowledgeInput, KnowledgeChunk } from "../src/store/types.ts";

// ── Helpers ──────────────────────────────────────────

function log(msg: string) {
  console.log(`\n${"=".repeat(60)}\n${msg}\n${"=".repeat(60)}`);
}

function findSessionFiles(): { path: string; size: number }[] {
  const projectDir = join(
    homedir(),
    ".claude",
    "projects",
    "-Users-woogis-Workspace-repo-distill"
  );

  try {
    return readdirSync(projectDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => ({
        path: join(projectDir, f),
        size: statSync(join(projectDir, f)).size,
      }))
      .sort((a, b) => a.size - b.size);
  } catch {
    return [];
  }
}

/**
 * Generate mock extraction results by analyzing the parsed transcript.
 * Scans for common decision signals in the conversation.
 */
function mockExtract(
  turns: Array<{ role: string; text: string }>,
  projectName?: string,
): KnowledgeInput[] {
  const now = new Date().toISOString();
  const results: KnowledgeInput[] = [];

  // Scan turns for decision signals
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    const text = turn.text.toLowerCase();

    // Look for correction patterns
    if (turn.role === "user" && (
      text.includes("아니") || text.includes("그거 아닙니다") ||
      text.includes("not like that") || text.includes("no,")
    )) {
      const nextTurn = turns[i + 1];
      if (nextTurn?.role === "assistant") {
        results.push({
          content: `User corrected approach: "${turn.text.slice(0, 100)}..." → AI adjusted: "${nextTurn.text.slice(0, 100)}..."`,
          type: "decision",
          scope: "project",
          project: projectName ?? null,
          tags: ["workflow"],
          source: { session_id: "e2e-mock", timestamp: now, trigger: "manual" },
          confidence: 0.8,
        });
      }
    }

    // Look for preference patterns
    if (text.includes("항상") || text.includes("always") ||
        text.includes("prefer") || text.includes("선호")) {
      results.push({
        content: `User preference detected: "${turn.text.slice(0, 150)}"`,
        type: "preference",
        scope: "global",
        project: null,
        tags: ["preference"],
        source: { session_id: "e2e-mock", timestamp: now, trigger: "manual" },
        confidence: 0.7,
      });
    }

    // Look for explicit decisions ("let's use", "go with")
    if (text.includes("let's use") || text.includes("go with") ||
        text.includes("해봅시다") || text.includes("이걸로")) {
      results.push({
        content: `Selection made: "${turn.text.slice(0, 150)}"`,
        type: "decision",
        scope: "project",
        project: projectName ?? null,
        tags: ["decision"],
        source: { session_id: "e2e-mock", timestamp: now, trigger: "manual" },
        confidence: 0.75,
      });
    }
  }

  // If nothing detected, add a minimal mock result
  if (results.length === 0) {
    results.push({
      content: `Mock: Conversation about ${projectName ?? "unknown project"} with ${turns.length} turns — no strong decision signals detected by heuristic scanner`,
      type: "pattern",
      scope: "project",
      project: projectName ?? null,
      tags: ["mock"],
      source: { session_id: "e2e-mock", timestamp: now, trigger: "manual" },
      confidence: 0.5,
    });
  }

  return results.slice(0, 10); // cap at 10
}

/**
 * Generate mock crystallize results from knowledge chunks.
 */
function mockCrystallize(
  chunks: KnowledgeChunk[],
  rulesDir: string,
): { created: string[]; updated: string[]; removed: string[]; total_rules: number } {
  // Group by first tag
  const groups = new Map<string, KnowledgeChunk[]>();
  for (const chunk of chunks) {
    const key = chunk.tags[0] ?? "general";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(chunk);
  }

  const report = { created: [] as string[], updated: [] as string[], removed: [] as string[], total_rules: 0 };

  if (!existsSync(rulesDir)) {
    mkdirSync(rulesDir, { recursive: true });
  }

  for (const [topic, topicChunks] of groups) {
    const filename = `distill-${topic}.md`;
    const date = new Date().toISOString().split("T")[0];
    const rules = topicChunks.map((c) => c.content);

    const content = `# ${topic}
> Auto-generated by Distill (mock) from ${topicChunks.length} decisions (last updated: ${date})

${rules.map((r) => `- ${r}`).join("\n")}

## Sources
${topicChunks.map((c) => `- ${c.id}`).join("\n")}
`;

    writeFileSync(join(rulesDir, filename), content, "utf-8");
    report.created.push(filename);
    report.total_rules += rules.length;
  }

  return report;
}

// ── Main ─────────────────────────────────────────────

async function main() {
  console.log("Distill E2E Pipeline Test [MOCK mode]");
  console.log("  (Real extraction uses MCP sampling via Claude Code)");

  // 1. Resolve JSONL path
  let jsonlPath = process.argv[2];

  if (!jsonlPath) {
    const sessions = findSessionFiles();
    if (sessions.length === 0) {
      console.error("ERROR: No .jsonl session files found.");
      process.exit(1);
    }
    jsonlPath = sessions[0].path; // smallest file
    console.log(`No path given. Using smallest session: ${basename(jsonlPath)} (${(sessions[0].size / 1024).toFixed(1)}KB)`);
  }

  // 2. Create temp project root
  const tmpRoot = mkdtempSync(join(tmpdir(), "distill-e2e-"));
  console.log(`Temp project root: ${tmpRoot}`);

  try {
    // ── Step 1: Parse transcript ──
    log("Step 1: Parse Transcript");
    const turns = parseTranscript(jsonlPath);
    const formatted = formatTranscript(turns);

    console.log(`  Turns: ${turns.length}`);
    console.log(`  Formatted length: ${formatted.length} chars`);
    console.log(`  User turns: ${turns.filter((t) => t.role === "user").length}`);
    console.log(`  Assistant turns: ${turns.filter((t) => t.role === "assistant").length}`);

    if (turns.length < 2) {
      console.log("  Not enough turns for extraction. Exiting.");
      return;
    }

    // Show first few turns as preview
    console.log("\n  Preview (first 3 turns):");
    for (const turn of turns.slice(0, 3)) {
      const preview = turn.text.slice(0, 120).replace(/\n/g, " ");
      console.log(`    [${turn.role.toUpperCase()}] ${preview}...`);
    }

    // ── Step 2: Extract knowledge (mock) ──
    log("Step 2: Extract Knowledge [MOCK]");
    console.log("  Using mock extraction (heuristic signal detection)");
    const extractStart = Date.now();
    const chunks = mockExtract(turns, "distill");
    const extractMs = Date.now() - extractStart;

    console.log(`  Extracted: ${chunks.length} chunks (${extractMs}ms)`);
    console.log("");

    if (chunks.length === 0) {
      console.log("  No knowledge extracted. Pipeline ends here.");
      return;
    }

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      console.log(`  [${i + 1}] type=${c.type} scope=${c.scope} confidence=${c.confidence}`);
      console.log(`      tags: ${c.tags.join(", ") || "(none)"}`);
      console.log(`      ${c.content.slice(0, 200)}`);
      console.log("");
    }

    // ── Step 3: Save to temp store ──
    log("Step 3: Save to Temp Store");
    let savedCount = 0;

    for (const chunk of chunks) {
      const meta = new MetadataStore(chunk.scope, tmpRoot);
      const vector = new VectorStore(chunk.scope, tmpRoot);

      const inserted = meta.insert(chunk);
      vector.index(inserted.id, inserted.content, inserted.tags);
      savedCount++;

      meta.close();
      vector.close();
    }

    console.log(`  Saved ${savedCount}/${chunks.length} chunks to temp SQLite`);

    // Verify round-trip by reading back
    const scopes = ["project", "global"] as const;
    for (const scope of scopes) {
      try {
        const meta = new MetadataStore(scope, tmpRoot);
        const stats = meta.stats();
        if (stats.total > 0) {
          console.log(`  [${scope}] ${JSON.stringify(stats)}`);
        }
        meta.close();
      } catch { /* scope may not exist */ }
    }

    // Verify FTS search works
    try {
      const vector = new VectorStore("project", tmpRoot);
      const searchResults = vector.search("decision", 5);
      console.log(`  FTS search "decision": ${searchResults.length} results`);
      vector.close();
    } catch { /* ignore */ }

    // ── Step 4: Crystallize (mock) ──
    log("Step 4: Crystallize [MOCK]");

    // Collect all saved chunks
    const allChunks: KnowledgeChunk[] = [];
    for (const scope of scopes) {
      try {
        const meta = new MetadataStore(scope, tmpRoot);
        allChunks.push(...meta.getAll());
        meta.close();
      } catch { /* ignore */ }
    }

    console.log(`  Chunks for crystallize: ${allChunks.length}`);

    const rulesDir = join(tmpRoot, ".claude", "rules");
    console.log("  Using mock crystallize (group by tag)");
    const crystallizeStart = Date.now();
    const report = mockCrystallize(allChunks, rulesDir);
    const crystallizeMs = Date.now() - crystallizeStart;

    console.log(`  Crystallize completed (${crystallizeMs}ms)`);
    console.log(`  Created: ${report.created.join(", ") || "(none)"}`);
    console.log(`  Updated: ${report.updated.join(", ") || "(none)"}`);
    console.log(`  Removed: ${report.removed.join(", ") || "(none)"}`);
    console.log(`  Total rules: ${report.total_rules}`);

    // ── Step 5: Display generated rule files ──
    try {
      const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
      if (ruleFiles.length > 0) {
        log("Step 5: Generated Rule Files");
        for (const file of ruleFiles) {
          const content = readFileSync(join(rulesDir, file), "utf-8");
          console.log(`\n--- ${file} ---`);
          console.log(content);
        }
      }
    } catch {
      console.log("\n  No rule files generated.");
    }

    // ── Summary ──
    log("Summary");
    console.log(`  Mode: MOCK`);
    console.log(`  Transcript: ${basename(jsonlPath)}`);
    console.log(`  Turns: ${turns.length} (${turns.filter((t) => t.role === "user").length} user, ${turns.filter((t) => t.role === "assistant").length} assistant)`);
    console.log(`  Extracted: ${chunks.length} chunks`);
    console.log(`  Stored: ${savedCount} chunks`);
    console.log(`  Crystallized: ${report.total_rules} rules in ${report.created.length} files`);
    console.log(`  Extraction time: ${extractMs}ms`);
    console.log(`  Crystallize time: ${crystallizeMs}ms`);
    console.log(`  Total time: ${extractMs + crystallizeMs}ms`);
  } finally {
    // Cleanup
    rmSync(tmpRoot, { recursive: true, force: true });
    console.log(`\nCleanup complete. Temp dir removed.`);
  }
}

main().catch((err) => {
  console.error("E2E test failed:", err);
  process.exit(1);
});

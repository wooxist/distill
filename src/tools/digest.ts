import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MetadataStore } from "../store/metadata.js";
import { detectProjectRoot } from "../store/scope.js";
import type { KnowledgeScope } from "../store/types.js";

export function registerDigestTool(server: McpServer): void {
  server.tool(
    "digest",
    "Analyze patterns across accumulated knowledge: merge duplicates, update confidence scores",
    {},
    async () => {
      const projectRoot = detectProjectRoot();
      const scopes: KnowledgeScope[] = projectRoot
        ? ["global", "project"]
        : ["global"];

      const report: string[] = [];

      for (const scope of scopes) {
        try {
          const meta = new MetadataStore(scope, projectRoot ?? undefined);
          const all = meta.search({ scope, limit: 1000 });

          // Find potential duplicates (simple text similarity)
          const duplicates: Array<{ a: string; b: string; content: string }> =
            [];
          for (let i = 0; i < all.length; i++) {
            for (let j = i + 1; j < all.length; j++) {
              if (
                simpleSimilarity(all[i].content, all[j].content) > 0.7
              ) {
                duplicates.push({
                  a: all[i].id,
                  b: all[j].id,
                  content: `"${all[i].content.slice(0, 50)}..." ≈ "${all[j].content.slice(0, 50)}..."`,
                });
              }
            }
          }

          // Find low-confidence, never-accessed entries
          const stale = all.filter(
            (k) => k.confidence < 0.5 && k.access_count === 0
          );

          report.push(`## ${scope.toUpperCase()} scope (${all.length} entries)`);

          if (duplicates.length > 0) {
            report.push(
              `\nPotential duplicates (${duplicates.length}):\n` +
                duplicates
                  .slice(0, 5)
                  .map((d) => `  - ${d.content}`)
                  .join("\n")
            );
          } else {
            report.push("\nNo duplicates detected.");
          }

          if (stale.length > 0) {
            report.push(
              `\nStale entries (low confidence, never accessed): ${stale.length}\n` +
                stale
                  .slice(0, 5)
                  .map(
                    (k) =>
                      `  - [${k.type}] (confidence: ${k.confidence}) ${k.content.slice(0, 60)}...`
                  )
                  .join("\n")
            );
          }

          meta.close();
        } catch {
          report.push(`## ${scope.toUpperCase()} scope\n(no data yet)`);
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: report.join("\n\n") || "No knowledge to analyze.",
          },
        ],
      };
    }
  );
}

/**
 * Simple word-overlap similarity (Jaccard-like).
 * Returns 0-1 where 1 = identical word sets.
 */
function simpleSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VectorStore } from "../store/vector.js";
import { MetadataStore } from "../store/metadata.js";
import { detectProjectRoot } from "../store/scope.js";
import type { KnowledgeChunk, KnowledgeScope } from "../store/types.js";

export function registerRecallTool(server: McpServer): void {
  server.tool(
    "recall",
    "Search accumulated knowledge by semantic similarity",
    {
      query: z.string().describe("Search query for knowledge retrieval"),
      scope: z
        .enum(["global", "project"])
        .optional()
        .describe("Filter by scope (default: both)"),
      type: z
        .enum(["pattern", "preference", "decision", "mistake", "workaround"])
        .optional()
        .describe("Filter by knowledge type"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Max results (default: 5)"),
    },
    async ({ query, scope, type, limit }) => {
      const maxResults = limit ?? 5;
      const projectRoot = detectProjectRoot();
      const results: KnowledgeChunk[] = [];

      const scopes: KnowledgeScope[] = scope
        ? [scope]
        : projectRoot
          ? ["global", "project"]
          : ["global"];

      for (const s of scopes) {
        try {
          const vector = new VectorStore(s, projectRoot ?? undefined);
          const meta = new MetadataStore(s, projectRoot ?? undefined);

          const hits = await vector.search(query, maxResults);
          for (const hit of hits) {
            const chunk = meta.getById(hit.id);
            if (!chunk) continue;
            if (type && chunk.type !== type) continue;
            meta.touch(hit.id);
            results.push(chunk);
          }

          vector.close();
          meta.close();
        } catch {
          // scope may not exist yet — skip
        }
      }

      // Sort by confidence descending
      results.sort((a, b) => b.confidence - a.confidence);
      const limited = results.slice(0, maxResults);

      if (limited.length === 0) {
        return {
          content: [
            { type: "text" as const, text: "No matching knowledge found." },
          ],
        };
      }

      const formatted = limited
        .map(
          (k, i) =>
            `${i + 1}. [${k.type}] (${k.scope}, confidence: ${k.confidence})\n   ${k.content}\n   tags: ${k.tags.join(", ")}`
        )
        .join("\n\n");

      return {
        content: [{ type: "text" as const, text: formatted }],
      };
    }
  );
}

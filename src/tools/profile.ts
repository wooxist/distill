import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MetadataStore } from "../store/metadata.js";
import { detectProjectRoot } from "../store/scope.js";
import type { KnowledgeScope } from "../store/types.js";

export function registerProfileTool(server: McpServer): void {
  server.tool(
    "profile",
    "View accumulated user knowledge profile and statistics",
    {
      scope: z
        .enum(["global", "project"])
        .optional()
        .describe("Filter by scope (default: both)"),
    },
    async ({ scope }) => {
      const projectRoot = detectProjectRoot();
      const scopes: KnowledgeScope[] = scope
        ? [scope]
        : projectRoot
          ? ["global", "project"]
          : ["global"];

      const sections: string[] = [];

      for (const s of scopes) {
        try {
          const meta = new MetadataStore(s, projectRoot ?? undefined);
          const stats = meta.stats();

          const typeBreakdown = Object.entries(stats.byType)
            .map(([k, v]) => `  ${k}: ${v}`)
            .join("\n");

          sections.push(
            `## ${s.toUpperCase()} scope\nTotal: ${stats.total}\n\nBy type:\n${typeBreakdown || "  (empty)"}`
          );

          // Show top accessed knowledge
          const topAccessed = meta.search({ scope: s, limit: 5 });
          if (topAccessed.length > 0) {
            const top = topAccessed
              .sort((a, b) => b.access_count - a.access_count)
              .slice(0, 3)
              .map(
                (k) =>
                  `  - [${k.type}] (accessed ${k.access_count}x) ${k.content.slice(0, 60)}...`
              )
              .join("\n");
            sections.push(`\nMost accessed:\n${top}`);
          }

          meta.close();
        } catch {
          sections.push(`## ${s.toUpperCase()} scope\n(no data yet)`);
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: sections.join("\n\n") || "No knowledge accumulated yet.",
          },
        ],
      };
    }
  );
}

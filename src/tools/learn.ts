import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";
import { extractKnowledge } from "../extractor/extractor.js";
import { MetadataStore } from "../store/metadata.js";
import { VectorStore } from "../store/vector.js";
import { detectProjectRoot } from "../store/scope.js";
import { loadConfig } from "../config.js";
import { crystallize } from "../extractor/crystallize.js";

export function registerLearnTool(mcpServer: McpServer, server: Server): void {
  mcpServer.tool(
    "learn",
    "Extract and save knowledge from a conversation transcript",
    {
      transcript_path: z
        .string()
        .describe("Path to the .jsonl transcript file"),
      session_id: z.string().describe("Session ID for tracking source"),
      scope: z
        .enum(["global", "project"])
        .optional()
        .describe("Force scope (default: auto-detect per chunk)"),
    },
    async ({ transcript_path, session_id, scope }) => {
      const projectRoot = detectProjectRoot();
      const projectName = projectRoot?.split("/").pop() ?? undefined;
      const config = loadConfig(projectRoot);

      // Extract knowledge from transcript via MCP sampling
      const chunks = await extractKnowledge({
        server,
        transcriptPath: transcript_path,
        sessionId: session_id,
        trigger: "manual",
        projectName,
        scopeOverride: scope,
        projectRoot,
      });

      if (chunks.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No extractable knowledge found in this transcript.",
            },
          ],
        };
      }

      // Save each chunk to the appropriate store
      let saved = 0;
      const conflictWarnings: string[] = [];

      for (const chunk of chunks) {
        try {
          const meta = new MetadataStore(chunk.scope, projectRoot ?? undefined);
          const vector = new VectorStore(chunk.scope, projectRoot ?? undefined);

          const inserted = meta.insert(chunk);
          await vector.index(inserted.id, inserted.content, inserted.tags);

          if (chunk.type === "conflict") {
            conflictWarnings.push(`  ⚠ CONFLICT: ${chunk.content.slice(0, 100)}`);
          }

          meta.close();
          vector.close();
          saved++;
        } catch (err) {
          console.error(`Failed to save chunk: ${err}`);
        }
      }

      const summary = chunks
        .map((c) => `- [${c.type}] ${c.content.slice(0, 80)}...`)
        .join("\n");

      const lines = [
        `Extracted ${chunks.length} knowledge chunks, saved ${saved}.`,
      ];

      if (conflictWarnings.length > 0) {
        lines.push("");
        lines.push("Rule conflicts detected:");
        lines.push(...conflictWarnings);
      }

      lines.push("");
      lines.push(summary);

      // Check auto-crystallize threshold
      let autoMsg = "";
      if (config.auto_crystallize_threshold > 0) {
        try {
          const globalMeta = new MetadataStore("global");
          const lastCrystallize = globalMeta.getMeta("last_crystallize") ?? "1970-01-01T00:00:00.000Z";
          const newCount = globalMeta.countSince(lastCrystallize);
          globalMeta.close();

          if (newCount >= config.auto_crystallize_threshold) {
            // Collect all chunks for crystallize
            const allChunks = [];
            try {
              const gm = new MetadataStore("global");
              allChunks.push(...gm.getAll());
              gm.close();
            } catch { /* ignore */ }
            if (projectRoot) {
              try {
                const pm = new MetadataStore("project", projectRoot);
                allChunks.push(...pm.getAll());
                pm.close();
              } catch { /* ignore */ }
            }

            const report = await crystallize({
              server,
              chunks: allChunks,
              model: config.crystallize_model,
              projectRoot,
            });

            const gm2 = new MetadataStore("global");
            gm2.setMeta("last_crystallize", new Date().toISOString());
            gm2.close();

            const parts = [];
            if (report.created.length > 0) parts.push(`created: ${report.created.join(", ")}`);
            if (report.updated.length > 0) parts.push(`updated: ${report.updated.join(", ")}`);
            if (report.removed.length > 0) parts.push(`removed: ${report.removed.join(", ")}`);
            autoMsg = `\n\n🔮 Auto-crystallize triggered (${newCount} chunks since last run): ${parts.join("; ") || "no changes"}`;
          }
        } catch (err) {
          autoMsg = `\n\n⚠ Auto-crystallize failed: ${err}`;
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: lines.join("\n") + autoMsg,
          },
        ],
      };
    }
  );
}

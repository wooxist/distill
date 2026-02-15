import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { extractKnowledge } from "../extractor/extractor.js";
import { MetadataStore } from "../store/metadata.js";
import { VectorStore } from "../store/vector.js";
import { detectProjectRoot } from "../store/scope.js";

export function registerLearnTool(server: McpServer): void {
  server.tool(
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

      // Extract knowledge from transcript
      const chunks = await extractKnowledge({
        transcriptPath: transcript_path,
        sessionId: session_id,
        trigger: "manual",
        projectName,
        scopeOverride: scope,
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
      for (const chunk of chunks) {
        try {
          const meta = new MetadataStore(chunk.scope, projectRoot ?? undefined);
          const vector = new VectorStore(chunk.scope, projectRoot ?? undefined);

          const inserted = meta.insert(chunk);
          vector.index(inserted.id, inserted.content, inserted.tags);

          meta.close();
          vector.close();
          saved++;
        } catch (err) {
          // Log but continue with other chunks
          console.error(`Failed to save chunk: ${err}`);
        }
      }

      const summary = chunks
        .map((c) => `- [${c.type}] ${c.content.slice(0, 80)}...`)
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `Extracted ${chunks.length} knowledge chunks, saved ${saved}.\n\n${summary}`,
          },
        ],
      };
    }
  );
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MetadataStore } from "../store/metadata.js";
import { VectorStore } from "../store/vector.js";
import { detectProjectRoot } from "../store/scope.js";

export function registerMemoryTool(server: McpServer): void {
  server.tool(
    "memory",
    "Manage knowledge: promote/demote scope, or delete entries",
    {
      action: z
        .enum(["promote", "demote", "delete"])
        .describe(
          "promote: project→global, demote: global→project, delete: remove"
        ),
      id: z.string().describe("Knowledge entry ID"),
    },
    async ({ action, id }) => {
      const projectRoot = detectProjectRoot();

      if (action === "delete") {
        for (const scope of ["global", "project"] as const) {
          try {
            const meta = new MetadataStore(scope, projectRoot ?? undefined);
            const vector = new VectorStore(scope, projectRoot ?? undefined);

            if (meta.delete(id)) {
              vector.remove(id);
              meta.close();
              vector.close();
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Deleted knowledge entry ${id} from ${scope} scope.`,
                  },
                ],
              };
            }

            meta.close();
            vector.close();
          } catch {
            continue;
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Knowledge entry ${id} not found.`,
            },
          ],
        };
      }

      // promote or demote
      const fromScope = action === "promote" ? "project" : "global";
      const toScope = action === "promote" ? "global" : "project";

      if (toScope === "project" && !projectRoot) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Cannot demote to project scope: no project root detected.",
            },
          ],
        };
      }

      try {
        const fromMeta = new MetadataStore(fromScope, projectRoot ?? undefined);
        const fromVector = new VectorStore(fromScope, projectRoot ?? undefined);
        const toMeta = new MetadataStore(toScope, projectRoot ?? undefined);
        const toVector = new VectorStore(toScope, projectRoot ?? undefined);

        const chunk = fromMeta.getById(id);
        if (!chunk) {
          fromMeta.close();
          fromVector.close();
          toMeta.close();
          toVector.close();
          return {
            content: [
              {
                type: "text" as const,
                text: `Knowledge entry ${id} not found in ${fromScope} scope.`,
              },
            ],
          };
        }

        const input = {
          content: chunk.content,
          type: chunk.type,
          scope: toScope as "global" | "project",
          project: toScope === "project" ? chunk.project : null,
          tags: chunk.tags,
          source: chunk.source,
          confidence: chunk.confidence,
        };
        const inserted = toMeta.insert(input);
        toVector.index(inserted.id, inserted.content, inserted.tags);

        fromMeta.delete(id);
        fromVector.remove(id);

        fromMeta.close();
        fromVector.close();
        toMeta.close();
        toVector.close();

        return {
          content: [
            {
              type: "text" as const,
              text: `${action === "promote" ? "Promoted" : "Demoted"} knowledge entry.\n${fromScope} → ${toScope}\nNew ID: ${inserted.id}\nContent: ${chunk.content.slice(0, 100)}...`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error during ${action}: ${err}`,
            },
          ],
        };
      }
    }
  );
}

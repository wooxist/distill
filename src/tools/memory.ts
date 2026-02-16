import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";
import { MetadataStore } from "../store/metadata.js";
import { VectorStore } from "../store/vector.js";
import { detectProjectRoot } from "../store/scope.js";
import { loadConfig } from "../config.js";
import { crystallize } from "../extractor/crystallize.js";
import type { KnowledgeChunk } from "../store/types.js";

export function registerMemoryTool(mcpServer: McpServer, server: Server): void {
  mcpServer.tool(
    "memory",
    "Manage knowledge: promote/demote scope, delete entries, or crystallize rules",
    {
      action: z
        .enum(["promote", "demote", "delete", "crystallize"])
        .describe(
          "promote: project→global, demote: global→project, delete: remove, crystallize: generate rules from accumulated knowledge"
        ),
      id: z.string().optional().describe("Knowledge entry ID (required for promote/demote/delete, ignored for crystallize)"),
    },
    async ({ action, id }) => {
      const projectRoot = detectProjectRoot();

      if (action === "crystallize") {
        return handleCrystallize(server, projectRoot);
      }

      if (!id) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Action "${action}" requires an id parameter.`,
            },
          ],
        };
      }

      if (action === "delete") {
        return handleDelete(id, projectRoot);
      }

      return handlePromoteDemote(action, id, projectRoot);
    }
  );
}

async function handleCrystallize(
  server: Server,
  projectRoot: string | null,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    const config = loadConfig(projectRoot);

    // Collect all chunks from both scopes
    const allChunks: KnowledgeChunk[] = [];

    try {
      const globalMeta = new MetadataStore("global");
      allChunks.push(...globalMeta.getAll());
      globalMeta.close();
    } catch {
      // global store may not exist yet
    }

    if (projectRoot) {
      try {
        const projectMeta = new MetadataStore("project", projectRoot);
        allChunks.push(...projectMeta.getAll());
        projectMeta.close();
      } catch {
        // project store may not exist yet
      }
    }

    if (allChunks.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No knowledge chunks to crystallize.",
          },
        ],
      };
    }

    const report = await crystallize({
      server,
      chunks: allChunks,
      model: config.crystallize_model,
      projectRoot,
    });

    // Update last crystallize timestamp
    try {
      const globalMeta = new MetadataStore("global");
      globalMeta.setMeta("last_crystallize", new Date().toISOString());
      globalMeta.close();
    } catch {
      // ignore
    }

    const lines: string[] = [`Crystallized ${allChunks.length} knowledge chunks.`];
    if (report.created.length > 0) {
      lines.push(`Created: ${report.created.join(", ")}`);
    }
    if (report.updated.length > 0) {
      lines.push(`Updated: ${report.updated.join(", ")}`);
    }
    if (report.removed.length > 0) {
      lines.push(`Removed: ${report.removed.join(", ")}`);
    }
    lines.push(`Total rules: ${report.total_rules}`);

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error during crystallize: ${err}`,
        },
      ],
    };
  }
}

function handleDelete(
  id: string,
  projectRoot: string | null,
): { content: Array<{ type: "text"; text: string }> } {
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

function handlePromoteDemote(
  action: "promote" | "demote",
  id: string,
  projectRoot: string | null,
): { content: Array<{ type: "text"; text: string }> } {
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

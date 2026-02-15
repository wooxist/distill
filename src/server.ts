#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerRecallTool } from "./tools/recall.js";
import { registerLearnTool } from "./tools/learn.js";
import { registerProfileTool } from "./tools/profile.js";
import { registerDigestTool } from "./tools/digest.js";
import { registerMemoryTool } from "./tools/memory.js";

const server = new McpServer({
  name: "distill",
  version: "1.0.0",
});

// Register all tools
registerRecallTool(server);
registerLearnTool(server);
registerProfileTool(server);
registerDigestTool(server);
registerMemoryTool(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Distill server error:", error);
  process.exit(1);
});

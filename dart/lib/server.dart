import 'package:mcp_dart/mcp_dart.dart';
import 'tools/recall.dart';
import 'tools/learn.dart';
import 'tools/profile.dart';
import 'tools/digest.dart';
import 'tools/memory.dart';

/// Create and configure the Distill MCP server with all tools registered.
McpServer createServer() {
  final server = McpServer(
    Implementation(name: 'distill', version: '1.0.0'),
    options: McpServerOptions(
      capabilities: ServerCapabilities(
        tools: ServerCapabilitiesTools(),
      ),
    ),
  );

  // Register all tools
  registerRecallTool(server);
  registerLearnTool(server);
  registerProfileTool(server);
  registerDigestTool(server);
  registerMemoryTool(server);

  return server;
}

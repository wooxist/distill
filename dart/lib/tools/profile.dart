import 'package:mcp_dart/mcp_dart.dart';
import '../store/metadata.dart';
import '../store/scope.dart';
import '../store/types.dart';

void registerProfileTool(McpServer server) {
  server.registerTool(
    'profile',
    description: 'View accumulated user knowledge profile and statistics',
    inputSchema: ToolInputSchema(
      properties: {
        'scope': JsonSchema.string(
          enumValues: ['global', 'project'],
          description: 'Filter by scope (default: both)',
        ),
      },
    ),
    callback: (args, extra) async {
      final scopeStr = args['scope'] as String?;
      final projectRoot = detectProjectRoot();

      final List<KnowledgeScope> scopes;
      if (scopeStr != null) {
        scopes = [KnowledgeScope.fromString(scopeStr)];
      } else if (projectRoot != null) {
        scopes = [KnowledgeScope.global, KnowledgeScope.project];
      } else {
        scopes = [KnowledgeScope.global];
      }

      final sections = <String>[];

      for (final s in scopes) {
        try {
          final meta = MetadataStore(s, projectRoot: projectRoot);
          final stats = meta.stats();

          final typeBreakdown = stats.byType.entries
              .map((e) => '  ${e.key}: ${e.value}')
              .join('\n');

          sections.add(
            '## ${s.name.toUpperCase()} scope\nTotal: ${stats.total}\n\nBy type:\n${typeBreakdown.isEmpty ? '  (empty)' : typeBreakdown}',
          );

          // Show top accessed knowledge
          final topAccessed = meta.search(scope: s, limit: 5);
          if (topAccessed.isNotEmpty) {
            final sorted = List<KnowledgeChunk>.from(topAccessed)
              ..sort((a, b) => b.accessCount.compareTo(a.accessCount));
            final top = sorted.take(3).map((k) {
              final contentPreview = k.content.length > 60
                  ? '${k.content.substring(0, 60)}...'
                  : k.content;
              return '  - [${k.type.name}] (accessed ${k.accessCount}x) $contentPreview';
            }).join('\n');
            sections.add('\nMost accessed:\n$top');
          }

          meta.close();
        } catch (_) {
          sections.add('## ${s.name.toUpperCase()} scope\n(no data yet)');
        }
      }

      return CallToolResult(
        content: [
          TextContent(
            text: sections.isNotEmpty
                ? sections.join('\n\n')
                : 'No knowledge accumulated yet.',
          ),
        ],
      );
    },
  );
}

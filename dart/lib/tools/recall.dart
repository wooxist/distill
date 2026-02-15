import 'package:mcp_dart/mcp_dart.dart';
import '../store/vector.dart';
import '../store/metadata.dart';
import '../store/scope.dart';
import '../store/types.dart';

void registerRecallTool(McpServer server) {
  server.registerTool(
    'recall',
    description: 'Search accumulated knowledge by semantic similarity',
    inputSchema: ToolInputSchema(
      properties: {
        'query': JsonSchema.string(
          description: 'Search query for knowledge retrieval',
        ),
        'scope': JsonSchema.string(
          enumValues: ['global', 'project'],
          description: 'Filter by scope (default: both)',
        ),
        'type': JsonSchema.string(
          enumValues: [
            'pattern',
            'preference',
            'decision',
            'mistake',
            'workaround',
          ],
          description: 'Filter by knowledge type',
        ),
        'limit': JsonSchema.integer(
          minimum: 1,
          maximum: 20,
          description: 'Max results (default: 5)',
        ),
      },
      required: ['query'],
    ),
    callback: (args, extra) async {
      final query = args['query'] as String;
      final scopeFilter = args['scope'] as String?;
      final typeFilter = args['type'] as String?;
      final maxResults = (args['limit'] as num?)?.toInt() ?? 5;

      final projectRoot = detectProjectRoot();
      final results = <KnowledgeChunk>[];

      final List<KnowledgeScope> scopes;
      if (scopeFilter != null) {
        scopes = [KnowledgeScope.fromString(scopeFilter)];
      } else if (projectRoot != null) {
        scopes = [KnowledgeScope.global, KnowledgeScope.project];
      } else {
        scopes = [KnowledgeScope.global];
      }

      for (final s in scopes) {
        try {
          final vector = VectorStore(s, projectRoot: projectRoot);
          final meta = MetadataStore(s, projectRoot: projectRoot);

          final hits = vector.search(query, limit: maxResults);
          for (final hit in hits) {
            final chunk = meta.getById(hit.id);
            if (chunk == null) continue;
            if (typeFilter != null && chunk.type.name != typeFilter) continue;
            meta.touch(hit.id);
            results.add(chunk);
          }

          vector.close();
          meta.close();
        } catch (_) {
          // scope may not exist yet — skip
        }
      }

      // Sort by confidence descending
      results.sort((a, b) => b.confidence.compareTo(a.confidence));
      final limited = results.take(maxResults).toList();

      if (limited.isEmpty) {
        return CallToolResult(
          content: [TextContent(text: 'No matching knowledge found.')],
        );
      }

      final formatted = limited.asMap().entries.map((e) {
        final i = e.key;
        final k = e.value;
        return '${i + 1}. [${k.type.name}] (${k.scope.name}, confidence: ${k.confidence})\n   ${k.content}\n   tags: ${k.tags.join(', ')}';
      }).join('\n\n');

      return CallToolResult(
        content: [TextContent(text: formatted)],
      );
    },
  );
}

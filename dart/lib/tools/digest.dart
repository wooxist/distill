import 'package:mcp_dart/mcp_dart.dart';
import '../store/metadata.dart';
import '../store/scope.dart';
import '../store/types.dart';

void registerDigestTool(McpServer server) {
  server.registerTool(
    'digest',
    description:
        'Analyze patterns across accumulated knowledge: merge duplicates, update confidence scores',
    inputSchema: ToolInputSchema(properties: {}),
    callback: (args, extra) async {
      final projectRoot = detectProjectRoot();
      final List<KnowledgeScope> scopes = projectRoot != null
          ? [KnowledgeScope.global, KnowledgeScope.project]
          : [KnowledgeScope.global];

      final report = <String>[];

      for (final scope in scopes) {
        try {
          final meta = MetadataStore(scope, projectRoot: projectRoot);
          final all = meta.search(scope: scope, limit: 1000);

          // Find potential duplicates (simple text similarity)
          final duplicates = <({String a, String b, String content})>[];
          for (var i = 0; i < all.length; i++) {
            for (var j = i + 1; j < all.length; j++) {
              if (_simpleSimilarity(all[i].content, all[j].content) > 0.7) {
                final contentA = all[i].content.length > 50
                    ? '${all[i].content.substring(0, 50)}...'
                    : all[i].content;
                final contentB = all[j].content.length > 50
                    ? '${all[j].content.substring(0, 50)}...'
                    : all[j].content;
                duplicates.add((
                  a: all[i].id,
                  b: all[j].id,
                  content: '"$contentA" \u2248 "$contentB"',
                ));
              }
            }
          }

          // Find low-confidence, never-accessed entries
          final stale = all
              .where((k) => k.confidence < 0.5 && k.accessCount == 0)
              .toList();

          report.add(
              '## ${scope.name.toUpperCase()} scope (${all.length} entries)');

          if (duplicates.isNotEmpty) {
            final dupLines = duplicates
                .take(5)
                .map((d) => '  - ${d.content}')
                .join('\n');
            report
                .add('\nPotential duplicates (${duplicates.length}):\n$dupLines');
          } else {
            report.add('\nNo duplicates detected.');
          }

          if (stale.isNotEmpty) {
            final staleLines = stale.take(5).map((k) {
              final contentPreview = k.content.length > 60
                  ? '${k.content.substring(0, 60)}...'
                  : k.content;
              return '  - [${k.type.name}] (confidence: ${k.confidence}) $contentPreview';
            }).join('\n');
            report.add(
              '\nStale entries (low confidence, never accessed): ${stale.length}\n$staleLines',
            );
          }

          meta.close();
        } catch (_) {
          report.add('## ${scope.name.toUpperCase()} scope\n(no data yet)');
        }
      }

      return CallToolResult(
        content: [
          TextContent(
            text: report.isNotEmpty
                ? report.join('\n\n')
                : 'No knowledge to analyze.',
          ),
        ],
      );
    },
  );
}

/// Simple word-overlap similarity (Jaccard-like).
/// Returns 0-1 where 1 = identical word sets.
double _simpleSimilarity(String a, String b) {
  final wordsA = a.toLowerCase().split(RegExp(r'\s+')).toSet();
  final wordsB = b.toLowerCase().split(RegExp(r'\s+')).toSet();
  final intersection = wordsA.intersection(wordsB);
  final union = wordsA.union(wordsB);
  return union.isEmpty ? 0.0 : intersection.length / union.length;
}

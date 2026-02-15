import 'dart:io';
import 'package:mcp_dart/mcp_dart.dart';
import '../extractor/extractor.dart';
import '../store/metadata.dart';
import '../store/vector.dart';
import '../store/scope.dart';
import '../store/types.dart';

void registerLearnTool(McpServer server) {
  server.registerTool(
    'learn',
    description: 'Extract and save knowledge from a conversation transcript',
    inputSchema: ToolInputSchema(
      properties: {
        'transcript_path': JsonSchema.string(
          description: 'Path to the .jsonl transcript file',
        ),
        'session_id': JsonSchema.string(
          description: 'Session ID for tracking source',
        ),
        'scope': JsonSchema.string(
          enumValues: ['global', 'project'],
          description: 'Force scope (default: auto-detect per chunk)',
        ),
      },
      required: ['transcript_path', 'session_id'],
    ),
    callback: (args, extra) async {
      final transcriptPath = args['transcript_path'] as String;
      final sessionId = args['session_id'] as String;
      final scopeStr = args['scope'] as String?;

      final projectRoot = detectProjectRoot();
      final projectName = projectRoot?.split('/').last;

      final scopeOverride =
          scopeStr != null ? KnowledgeScope.fromString(scopeStr) : null;

      // Extract knowledge from transcript
      final chunks = await extractKnowledge(
        transcriptPath: transcriptPath,
        sessionId: sessionId,
        trigger: ExtractionTrigger.manual,
        projectName: projectName,
        scopeOverride: scopeOverride,
      );

      if (chunks.isEmpty) {
        return CallToolResult(
          content: [
            TextContent(
              text: 'No extractable knowledge found in this transcript.',
            ),
          ],
        );
      }

      // Save each chunk to the appropriate store
      var saved = 0;
      for (final chunk in chunks) {
        try {
          final meta = MetadataStore(chunk.scope, projectRoot: projectRoot);
          final vector = VectorStore(chunk.scope, projectRoot: projectRoot);

          final inserted = meta.insert(chunk);
          vector.index(inserted.id, inserted.content, inserted.tags);

          meta.close();
          vector.close();
          saved++;
        } catch (err) {
          stderr.writeln('Failed to save chunk: $err');
        }
      }

      final summary =
          chunks.map((c) => '- [${c.type.name}] ${c.content.length > 80 ? '${c.content.substring(0, 80)}...' : c.content}').join('\n');

      return CallToolResult(
        content: [
          TextContent(
            text: 'Extracted ${chunks.length} knowledge chunks, saved $saved.\n\n$summary',
          ),
        ],
      );
    },
  );
}

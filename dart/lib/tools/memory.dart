import 'package:mcp_dart/mcp_dart.dart';
import '../store/metadata.dart';
import '../store/vector.dart';
import '../store/scope.dart';
import '../store/types.dart';

void registerMemoryTool(McpServer server) {
  server.registerTool(
    'memory',
    description: 'Manage knowledge: promote/demote scope, or delete entries',
    inputSchema: ToolInputSchema(
      properties: {
        'action': JsonSchema.string(
          enumValues: ['promote', 'demote', 'delete'],
          description:
              'promote: project\u2192global, demote: global\u2192project, delete: remove',
        ),
        'id': JsonSchema.string(
          description: 'Knowledge entry ID',
        ),
      },
      required: ['action', 'id'],
    ),
    callback: (args, extra) async {
      final action = args['action'] as String;
      final id = args['id'] as String;
      final projectRoot = detectProjectRoot();

      if (action == 'delete') {
        for (final scope in [KnowledgeScope.global, KnowledgeScope.project]) {
          try {
            final meta = MetadataStore(scope, projectRoot: projectRoot);
            final vector = VectorStore(scope, projectRoot: projectRoot);

            if (meta.delete(id)) {
              vector.remove(id);
              meta.close();
              vector.close();
              return CallToolResult(
                content: [
                  TextContent(
                    text:
                        'Deleted knowledge entry $id from ${scope.name} scope.',
                  ),
                ],
              );
            }

            meta.close();
            vector.close();
          } catch (_) {
            continue;
          }
        }

        return CallToolResult(
          content: [
            TextContent(text: 'Knowledge entry $id not found.'),
          ],
        );
      }

      // promote or demote
      final fromScope = action == 'promote'
          ? KnowledgeScope.project
          : KnowledgeScope.global;
      final toScope = action == 'promote'
          ? KnowledgeScope.global
          : KnowledgeScope.project;

      if (toScope == KnowledgeScope.project && projectRoot == null) {
        return CallToolResult(
          content: [
            TextContent(
              text:
                  'Cannot demote to project scope: no project root detected.',
            ),
          ],
        );
      }

      try {
        final fromMeta = MetadataStore(fromScope, projectRoot: projectRoot);
        final fromVector = VectorStore(fromScope, projectRoot: projectRoot);
        final toMeta = MetadataStore(toScope, projectRoot: projectRoot);
        final toVector = VectorStore(toScope, projectRoot: projectRoot);

        final chunk = fromMeta.getById(id);
        if (chunk == null) {
          fromMeta.close();
          fromVector.close();
          toMeta.close();
          toVector.close();
          return CallToolResult(
            content: [
              TextContent(
                text:
                    'Knowledge entry $id not found in ${fromScope.name} scope.',
              ),
            ],
          );
        }

        final input = KnowledgeInput(
          content: chunk.content,
          type: chunk.type,
          scope: toScope,
          project: toScope == KnowledgeScope.project ? chunk.project : null,
          tags: chunk.tags,
          source: chunk.source,
          confidence: chunk.confidence,
        );
        final inserted = toMeta.insert(input);
        toVector.index(inserted.id, inserted.content, inserted.tags);

        fromMeta.delete(id);
        fromVector.remove(id);

        fromMeta.close();
        fromVector.close();
        toMeta.close();
        toVector.close();

        final contentPreview = chunk.content.length > 100
            ? '${chunk.content.substring(0, 100)}...'
            : chunk.content;
        final actionLabel = action == 'promote' ? 'Promoted' : 'Demoted';

        return CallToolResult(
          content: [
            TextContent(
              text:
                  '$actionLabel knowledge entry.\n${fromScope.name} \u2192 ${toScope.name}\nNew ID: ${inserted.id}\nContent: $contentPreview',
            ),
          ],
        );
      } catch (err) {
        return CallToolResult(
          content: [
            TextContent(text: 'Error during $action: $err'),
          ],
        );
      }
    },
  );
}

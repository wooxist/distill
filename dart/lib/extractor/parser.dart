import 'dart:convert';
import 'dart:io';

/// A single conversational turn parsed from .jsonl.
class ConversationTurn {
  final String role; // 'user' or 'assistant'
  final String text;
  final String? timestamp;

  const ConversationTurn({
    required this.role,
    required this.text,
    this.timestamp,
  });
}

/// Parse a Claude Code .jsonl transcript into conversation turns.
///
/// Extracts only user and assistant text content.
/// Skips tool_use, tool_result, thinking, system messages.
List<ConversationTurn> parseTranscript(String filePath) {
  final raw = File(filePath).readAsStringSync();
  final lines = raw.split('\n').where((l) => l.trim().isNotEmpty);
  final turns = <ConversationTurn>[];

  for (final line in lines) {
    Map<String, dynamic> entry;
    try {
      entry = jsonDecode(line) as Map<String, dynamic>;
    } catch (_) {
      continue; // skip malformed lines
    }

    // Only process user/assistant messages
    final entryType = entry['type'] as String?;
    if (entryType != 'user' && entryType != 'assistant') continue;

    final role = entryType!;
    final message = entry['message'] as Map<String, dynamic>?;
    if (message == null) continue;

    final content = message['content'] as List<dynamic>?;
    if (content == null) continue;

    // Extract text content only
    final textParts = <String>[];
    for (final block in content) {
      if (block is Map<String, dynamic> &&
          block['type'] == 'text' &&
          block.containsKey('text')) {
        textParts.add(block['text'] as String);
      }
    }

    final text = textParts.join('\n').trim();
    if (text.isEmpty) continue;

    turns.add(ConversationTurn(
      role: role,
      text: text,
      timestamp: entry['timestamp'] as String?,
    ));
  }

  return turns;
}

/// Format conversation turns into a readable transcript for the LLM.
String formatTranscript(List<ConversationTurn> turns) {
  return turns
      .map((t) => '[${t.role.toUpperCase()}]\n${t.text}')
      .join('\n\n---\n\n');
}

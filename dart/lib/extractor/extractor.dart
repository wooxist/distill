import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'parser.dart';
import 'prompts.dart';
import '../store/types.dart';

/// Raw extraction result from LLM.
class _RawExtraction {
  final String content;
  final String type;
  final String scope;
  final List<String> tags;
  final double confidence;

  _RawExtraction({
    required this.content,
    required this.type,
    required this.scope,
    required this.tags,
    required this.confidence,
  });
}

const _maxTranscriptChars = 100000; // ~25k tokens, safe for Haiku

/// Extract knowledge from a .jsonl transcript file.
Future<List<KnowledgeInput>> extractKnowledge({
  required String transcriptPath,
  required String sessionId,
  required ExtractionTrigger trigger,
  String? projectName,
  KnowledgeScope? scopeOverride,
}) async {
  // 1. Parse transcript
  final turns = parseTranscript(transcriptPath);
  if (turns.length < 2) return []; // need at least 1 exchange

  // 2. Format and truncate
  var formatted = formatTranscript(turns);
  if (formatted.length > _maxTranscriptChars) {
    formatted = _truncateToRecent(turns, _maxTranscriptChars);
  }

  // 3. Call LLM
  final raw = await _callLlm(formatted, projectName);
  if (raw.isEmpty) return [];

  // 4. Convert to KnowledgeInput
  final now = DateTime.now().toUtc().toIso8601String();
  return raw.map((r) {
    final chunkScope = scopeOverride ?? KnowledgeScope.fromString(r.scope);
    return KnowledgeInput(
      content: r.content,
      type: KnowledgeType.fromString(r.type),
      scope: chunkScope,
      project: r.scope == 'project' ? projectName : null,
      tags: r.tags,
      source: KnowledgeSource(
        sessionId: sessionId,
        timestamp: now,
        trigger: trigger,
      ),
      confidence: r.confidence,
    );
  }).toList();
}

Future<List<_RawExtraction>> _callLlm(
  String formattedTranscript,
  String? projectName,
) async {
  final apiKey = Platform.environment['ANTHROPIC_API_KEY'];
  if (apiKey == null || apiKey.isEmpty) {
    throw StateError(
      'ANTHROPIC_API_KEY environment variable is required for extraction',
    );
  }

  final body = jsonEncode({
    'model': 'claude-haiku-4-5-20251001',
    'max_tokens': 4096,
    'system': extractionSystemPrompt,
    'messages': [
      {
        'role': 'user',
        'content': buildExtractionPrompt(formattedTranscript,
            projectName: projectName),
      },
    ],
  });

  final response = await http.post(
    Uri.parse('https://api.anthropic.com/v1/messages'),
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: body,
  );

  if (response.statusCode != 200) {
    throw HttpException(
      'Anthropic API error: ${response.statusCode} ${response.body}',
    );
  }

  final responseJson = jsonDecode(response.body) as Map<String, dynamic>;
  final contentBlocks = responseJson['content'] as List<dynamic>;

  // Extract text from response
  final textParts = <String>[];
  for (final block in contentBlocks) {
    if (block is Map<String, dynamic> && block['type'] == 'text') {
      textParts.add(block['text'] as String);
    }
  }

  final text = textParts.join('');
  return _parseExtractionResponse(text);
}

List<_RawExtraction> _parseExtractionResponse(String text) {
  // Try to find JSON array in the response
  final jsonMatch = RegExp(r'\[[\s\S]*\]').firstMatch(text);
  if (jsonMatch == null) return [];

  try {
    final parsed = jsonDecode(jsonMatch.group(0)!);
    if (parsed is! List) return [];

    const validTypes = ['pattern', 'preference', 'decision', 'mistake', 'workaround'];
    const validScopes = ['global', 'project'];

    return parsed
        .where((item) =>
            item is Map<String, dynamic> &&
            item['content'] is String &&
            validTypes.contains(item['type']) &&
            validScopes.contains(item['scope']) &&
            item['tags'] is List &&
            item['confidence'] is num &&
            (item['confidence'] as num) >= 0 &&
            (item['confidence'] as num) <= 1)
        .map((item) => _RawExtraction(
              content: item['content'] as String,
              type: item['type'] as String,
              scope: item['scope'] as String,
              tags: (item['tags'] as List).cast<String>(),
              confidence: (item['confidence'] as num).toDouble(),
            ))
        .toList();
  } catch (_) {
    return [];
  }
}

/// Truncate transcript to fit within char limit, keeping recent turns.
String _truncateToRecent(List<ConversationTurn> turns, int maxChars) {
  final result = <ConversationTurn>[];
  var total = 0;

  // Walk backwards, keeping recent turns
  for (var i = turns.length - 1; i >= 0; i--) {
    final entry =
        '[${turns[i].role.toUpperCase()}]\n${turns[i].text}\n\n---\n\n';
    if (total + entry.length > maxChars) break;
    total += entry.length;
    result.insert(0, turns[i]);
  }

  return formatTranscript(result);
}

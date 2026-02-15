import 'dart:io';
import 'package:path/path.dart' as p;

String? _cachedSystemPrompt;
String? _cachedUserTemplate;

/// Load and cache the system prompt from shared/prompts.md.
String get extractionSystemPrompt {
  if (_cachedSystemPrompt != null) return _cachedSystemPrompt!;
  _loadPrompts();
  return _cachedSystemPrompt!;
}

/// Load and cache the user prompt template from shared/prompts.md.
String get _userTemplate {
  if (_cachedUserTemplate != null) return _cachedUserTemplate!;
  _loadPrompts();
  return _cachedUserTemplate!;
}

void _loadPrompts() {
  // Resolve path relative to this file's location:
  // dart/lib/extractor/prompts.dart -> ../../shared/prompts.md
  // We try multiple strategies to find the file.
  final candidates = [
    // From dart project root (most common at runtime)
    p.join(Directory.current.path, '..', 'shared', 'prompts.md'),
    // From the distill repo root
    p.join(Directory.current.path, 'shared', 'prompts.md'),
    // Absolute fallback using Platform.script
    _resolveFromScript(),
  ].whereType<String>();

  String? content;
  for (final candidate in candidates) {
    final file = File(candidate);
    if (file.existsSync()) {
      content = file.readAsStringSync();
      break;
    }
  }

  if (content == null) {
    // Fallback: use inline prompts (same as TS version)
    _cachedSystemPrompt = _fallbackSystemPrompt;
    _cachedUserTemplate = _fallbackUserTemplate;
    return;
  }

  // Parse the prompts.md file
  _parsePromptsFile(content);
}

String? _resolveFromScript() {
  try {
    final scriptDir = p.dirname(Platform.script.toFilePath());
    return p.normalize(
        p.join(scriptDir, '..', '..', '..', 'shared', 'prompts.md'));
  } catch (_) {
    return null;
  }
}

void _parsePromptsFile(String content) {
  // Extract system prompt between first ``` pair under "## System Prompt"
  final systemMatch = RegExp(
    r'## System Prompt\s*\n\s*```\n([\s\S]*?)\n```',
  ).firstMatch(content);

  _cachedSystemPrompt = systemMatch?.group(1)?.trim() ?? _fallbackSystemPrompt;

  // Extract user prompt template between ``` pair under "## User Prompt Template"
  final userMatch = RegExp(
    r'## User Prompt Template\s*\n\s*```\n([\s\S]*?)\n```',
  ).firstMatch(content);

  _cachedUserTemplate = userMatch?.group(1)?.trim() ?? _fallbackUserTemplate;
}

/// Build the user prompt with the actual transcript.
String buildExtractionPrompt(String formattedTranscript, {String? projectName}) {
  final projectContext =
      projectName != null ? '\n\nProject context: "$projectName"' : '';

  final template = _userTemplate;
  return template
      .replaceAll('{{TRANSCRIPT}}', formattedTranscript)
      .replaceAll('{{PROJECT_CONTEXT}}', projectContext);
}

// --- Fallback inline prompts (same as TS version) ---

const _fallbackSystemPrompt =
    '''You are a knowledge extraction engine. Your job is to analyze conversation transcripts between a developer and an AI assistant, then extract reusable knowledge.

## Extraction Criteria

1. **Negative→Positive transitions**: The user rejected something ("안 돼", "아닌데", "그게 아니라", "no", "that's wrong") and then a correct conclusion was reached. These are the highest-value extractions.

2. **Explicit preferences**: "이렇게 해줘", "항상 ~로", "I prefer", consistent choices across the conversation.

3. **Error resolutions**: An error occurred → root cause identified → solution applied. Extract the final conclusion, not the debugging process.

4. **Repeated patterns**: Code or architecture patterns that appear multiple times, indicating established conventions.

## Exclusion Criteria

- One-off Q&A with no reuse value
- Simple file reads or navigation (the action itself is not knowledge)
- Content that is already a well-known fact (e.g., "JavaScript is single-threaded")

## Scope Classification

- Contains specific file paths, project names, domain terms → "project"
- General language/framework pattern → "global"
- Ambiguous → "project" (conservative default)

## Output Format

Respond with a JSON array. If no knowledge is found, return an empty array `[]`.

Each element:
{
  "content": "Clear, concise statement of the knowledge",
  "type": "pattern | preference | decision | mistake | workaround",
  "scope": "global | project",
  "tags": ["tag1", "tag2"],
  "confidence": 0.0-1.0
}

Rules:
- "content" must be a self-contained statement (understandable without the conversation)
- "confidence" reflects how certain the knowledge is (0.9+ for explicit statements, 0.5-0.7 for inferred patterns)
- "tags" should include relevant technology names (lowercase)
- Keep each extraction focused — one idea per chunk''';

const _fallbackUserTemplate =
    '''Analyze the following conversation transcript and extract reusable knowledge.{{PROJECT_CONTEXT}}

<transcript>
{{TRANSCRIPT}}
</transcript>

Extract knowledge as a JSON array. If nothing valuable is found, return `[]`.''';

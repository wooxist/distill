/// Knowledge type classification.
enum KnowledgeType {
  pattern,
  preference,
  decision,
  mistake,
  workaround;

  static KnowledgeType fromString(String value) {
    return KnowledgeType.values.firstWhere(
      (e) => e.name == value,
      orElse: () => throw ArgumentError('Invalid KnowledgeType: $value'),
    );
  }
}

/// Knowledge scope.
enum KnowledgeScope {
  global,
  project;

  static KnowledgeScope fromString(String value) {
    return KnowledgeScope.values.firstWhere(
      (e) => e.name == value,
      orElse: () => throw ArgumentError('Invalid KnowledgeScope: $value'),
    );
  }
}

/// Trigger that caused extraction.
enum ExtractionTrigger {
  preCompact('pre_compact'),
  sessionEnd('session_end'),
  manual('manual');

  final String value;
  const ExtractionTrigger(this.value);

  static ExtractionTrigger fromString(String value) {
    return ExtractionTrigger.values.firstWhere(
      (e) => e.value == value,
      orElse: () => throw ArgumentError('Invalid ExtractionTrigger: $value'),
    );
  }
}

/// Source information for a knowledge chunk.
class KnowledgeSource {
  final String sessionId;
  final String timestamp;
  final ExtractionTrigger trigger;

  const KnowledgeSource({
    required this.sessionId,
    required this.timestamp,
    required this.trigger,
  });
}

/// A single knowledge chunk extracted from conversation.
class KnowledgeChunk {
  final String id;
  final String content;
  final KnowledgeType type;
  final KnowledgeScope scope;
  final String? project;
  final List<String> tags;
  final KnowledgeSource source;
  final double confidence;
  final int accessCount;
  final String createdAt;
  final String updatedAt;

  const KnowledgeChunk({
    required this.id,
    required this.content,
    required this.type,
    required this.scope,
    this.project,
    required this.tags,
    required this.source,
    required this.confidence,
    required this.accessCount,
    required this.createdAt,
    required this.updatedAt,
  });
}

/// Input for creating a new knowledge chunk (before ID/timestamps).
class KnowledgeInput {
  final String content;
  final KnowledgeType type;
  final KnowledgeScope scope;
  final String? project;
  final List<String> tags;
  final KnowledgeSource source;
  final double confidence;

  const KnowledgeInput({
    required this.content,
    required this.type,
    required this.scope,
    this.project,
    required this.tags,
    required this.source,
    required this.confidence,
  });
}

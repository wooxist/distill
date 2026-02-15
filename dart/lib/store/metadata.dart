import 'dart:convert';
import 'package:sqlite3/sqlite3.dart';
import 'package:uuid/uuid.dart';
import 'scope.dart';
import 'types.dart';

const _schema = '''
CREATE TABLE IF NOT EXISTS knowledge (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('pattern','preference','decision','mistake','workaround')),
  scope TEXT NOT NULL CHECK(scope IN ('global','project')),
  project TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  session_id TEXT NOT NULL,
  "trigger" TEXT NOT NULL CHECK("trigger" IN ('pre_compact','session_end','manual')),
  source_timestamp TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  access_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_scope ON knowledge(scope);
CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge(project);
''';

const _uuid = Uuid();

/// Metadata store backed by SQLite.
class MetadataStore {
  final Database _db;

  MetadataStore(KnowledgeScope scope, {String? projectRoot})
      : _db = sqlite3.open(resolveDbPath(scope, projectRoot: projectRoot)) {
    _db.execute('PRAGMA journal_mode = WAL');
    _db.execute(_schema);
  }

  /// Insert a new knowledge chunk, returns full chunk with generated id/timestamps.
  KnowledgeChunk insert(KnowledgeInput input) {
    final now = DateTime.now().toUtc().toIso8601String();
    final id = _uuid.v4();

    final stmt = _db.prepare('''
      INSERT INTO knowledge (id, content, type, scope, project, tags, session_id, "trigger", source_timestamp, confidence, access_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    ''');

    stmt.execute([
      id,
      input.content,
      input.type.name,
      input.scope.name,
      input.project,
      jsonEncode(input.tags),
      input.source.sessionId,
      input.source.trigger.value,
      input.source.timestamp,
      input.confidence,
      now,
      now,
    ]);
    stmt.dispose();

    return KnowledgeChunk(
      id: id,
      content: input.content,
      type: input.type,
      scope: input.scope,
      project: input.project,
      tags: List<String>.from(input.tags),
      source: input.source,
      confidence: input.confidence,
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
    );
  }

  /// Get a knowledge chunk by ID.
  KnowledgeChunk? getById(String id) {
    final result = _db.select('SELECT * FROM knowledge WHERE id = ?', [id]);
    if (result.isEmpty) return null;
    return _rowToChunk(result.first);
  }

  /// Search by filters (non-vector, metadata only).
  List<KnowledgeChunk> search({
    KnowledgeScope? scope,
    KnowledgeType? type,
    String? project,
    int limit = 20,
  }) {
    final conditions = <String>[];
    final params = <Object?>[];

    if (scope != null) {
      conditions.add('scope = ?');
      params.add(scope.name);
    }
    if (type != null) {
      conditions.add('type = ?');
      params.add(type.name);
    }
    if (project != null) {
      conditions.add('project = ?');
      params.add(project);
    }

    final where =
        conditions.isNotEmpty ? 'WHERE ${conditions.join(' AND ')}' : '';

    params.add(limit);

    final result = _db.select(
      'SELECT * FROM knowledge $where ORDER BY updated_at DESC LIMIT ?',
      params,
    );

    return result.map(_rowToChunk).toList();
  }

  /// Increment access count (called on recall).
  void touch(String id) {
    final stmt = _db.prepare(
      'UPDATE knowledge SET access_count = access_count + 1, updated_at = ? WHERE id = ?',
    );
    stmt.execute([DateTime.now().toUtc().toIso8601String(), id]);
    stmt.dispose();
  }

  /// Update scope (promote/demote).
  void updateScope(String id, KnowledgeScope newScope) {
    final stmt = _db.prepare(
      'UPDATE knowledge SET scope = ?, updated_at = ? WHERE id = ?',
    );
    stmt.execute([newScope.name, DateTime.now().toUtc().toIso8601String(), id]);
    stmt.dispose();
  }

  /// Delete a knowledge entry.
  bool delete(String id) {
    final stmt = _db.prepare('DELETE FROM knowledge WHERE id = ?');
    stmt.execute([id]);
    stmt.dispose();
    return _db.updatedRows > 0;
  }

  /// Get aggregate statistics.
  MetadataStats stats() {
    final totalResult =
        _db.select('SELECT COUNT(*) as cnt FROM knowledge');
    final total = totalResult.first['cnt'] as int;

    final byType = <String, int>{};
    final typeRows =
        _db.select('SELECT type, COUNT(*) as cnt FROM knowledge GROUP BY type');
    for (final row in typeRows) {
      byType[row['type'] as String] = row['cnt'] as int;
    }

    final byScope = <String, int>{};
    final scopeRows = _db
        .select('SELECT scope, COUNT(*) as cnt FROM knowledge GROUP BY scope');
    for (final row in scopeRows) {
      byScope[row['scope'] as String] = row['cnt'] as int;
    }

    return MetadataStats(total: total, byType: byType, byScope: byScope);
  }

  /// Close the database connection.
  void close() {
    _db.dispose();
  }
}

/// Aggregate statistics for knowledge store.
class MetadataStats {
  final int total;
  final Map<String, int> byType;
  final Map<String, int> byScope;

  const MetadataStats({
    required this.total,
    required this.byType,
    required this.byScope,
  });
}

KnowledgeChunk _rowToChunk(Row row) {
  return KnowledgeChunk(
    id: row['id'] as String,
    content: row['content'] as String,
    type: KnowledgeType.fromString(row['type'] as String),
    scope: KnowledgeScope.fromString(row['scope'] as String),
    project: row['project'] as String?,
    tags: List<String>.from(jsonDecode(row['tags'] as String) as List),
    source: KnowledgeSource(
      sessionId: row['session_id'] as String,
      timestamp: row['source_timestamp'] as String,
      trigger: ExtractionTrigger.fromString(row['trigger'] as String),
    ),
    confidence: (row['confidence'] as num).toDouble(),
    accessCount: row['access_count'] as int,
    createdAt: row['created_at'] as String,
    updatedAt: row['updated_at'] as String,
  );
}

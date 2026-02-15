import 'package:sqlite3/sqlite3.dart';
import 'scope.dart';
import 'types.dart';

const _ftsSchema = '''
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  id UNINDEXED,
  content,
  tags
);
''';

/// Search result from vector/FTS search.
class SearchResult {
  final String id;
  final String content;
  final List<String> tags;
  final double score;

  const SearchResult({
    required this.id,
    required this.content,
    required this.tags,
    required this.score,
  });
}

/// Vector store for semantic knowledge search.
///
/// MVP: Uses SQLite FTS5 for full-text search.
/// Upgrade path: Replace with ChromaDB or another vector DB
/// when embedding infrastructure is available.
class VectorStore {
  final Database _db;

  VectorStore(KnowledgeScope scope, {String? projectRoot})
      : _db = sqlite3.open(resolveDbPath(scope, projectRoot: projectRoot)) {
    _db.execute('PRAGMA journal_mode = WAL');
    _db.execute(_ftsSchema);
  }

  /// Index a knowledge chunk for search.
  void index(String id, String content, List<String> tags) {
    final stmt = _db.prepare(
      'INSERT OR REPLACE INTO knowledge_fts (id, content, tags) VALUES (?, ?, ?)',
    );
    stmt.execute([id, content, tags.join(' ')]);
    stmt.dispose();
  }

  /// Search by query string using FTS5 ranking.
  List<SearchResult> search(String query, {int limit = 5}) {
    final sanitized = _sanitizeFtsQuery(query);
    if (sanitized.isEmpty) return [];

    final results = _db.select(
      '''SELECT id, content, tags, rank
         FROM knowledge_fts
         WHERE knowledge_fts MATCH ?
         ORDER BY rank
         LIMIT ?''',
      [sanitized, limit],
    );

    return results.map((row) {
      final tagsStr = row['tags'] as String;
      return SearchResult(
        id: row['id'] as String,
        content: row['content'] as String,
        tags: tagsStr.split(' ').where((t) => t.isNotEmpty).toList(),
        score: -(row['rank'] as num).toDouble(), // FTS5 rank is negative (lower = better)
      );
    }).toList();
  }

  /// Remove an entry from the search index.
  void remove(String id) {
    final stmt = _db.prepare('DELETE FROM knowledge_fts WHERE id = ?');
    stmt.execute([id]);
    stmt.dispose();
  }

  /// Close the database connection.
  void close() {
    _db.dispose();
  }
}

/// Sanitize query for FTS5 MATCH syntax.
/// Splits into tokens and joins with OR for broad matching.
String _sanitizeFtsQuery(String query) {
  final tokens = query
      .replaceAll(RegExp(r'[^\p{L}\p{N}\s]', unicode: true), ' ')
      .split(RegExp(r'\s+'))
      .where((t) => t.isNotEmpty)
      .toList();

  if (tokens.isEmpty) return '';

  // Join tokens with OR for broad matching
  return tokens.map((t) => '"$t"').join(' OR ');
}

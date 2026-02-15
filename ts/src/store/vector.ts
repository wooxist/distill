import Database from "better-sqlite3";
import { resolveDbPath } from "./scope.js";
import type { KnowledgeScope } from "./types.js";

const FTS_SCHEMA = `
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  id UNINDEXED,
  content,
  tags
);
`;

/**
 * Vector store for semantic knowledge search.
 *
 * MVP: Uses SQLite FTS5 for full-text search.
 * Upgrade path: Replace with ChromaDB or another vector DB
 * when embedding infrastructure is available.
 */
export class VectorStore {
  private db: Database.Database;

  constructor(scope: KnowledgeScope, projectRoot?: string) {
    const dbPath = resolveDbPath(scope, projectRoot);
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(FTS_SCHEMA);
  }

  /** Index a knowledge chunk for search */
  index(id: string, content: string, tags: string[]): void {
    this.db
      .prepare("INSERT OR REPLACE INTO knowledge_fts (id, content, tags) VALUES (?, ?, ?)")
      .run(id, content, tags.join(" "));
  }

  /** Search by query string using FTS5 ranking */
  search(query: string, limit: number = 5): SearchResult[] {
    // FTS5 match query — handle simple queries
    const sanitized = sanitizeFtsQuery(query);
    if (!sanitized) return [];

    const rows = this.db
      .prepare(
        `SELECT id, content, tags, rank
         FROM knowledge_fts
         WHERE knowledge_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(sanitized, limit) as FtsRow[];

    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      tags: row.tags.split(" ").filter(Boolean),
      score: -row.rank, // FTS5 rank is negative (lower = better)
    }));
  }

  /** Remove an entry from the search index */
  remove(id: string): void {
    this.db
      .prepare("DELETE FROM knowledge_fts WHERE id = ?")
      .run(id);
  }

  close(): void {
    this.db.close();
  }
}

export interface SearchResult {
  id: string;
  content: string;
  tags: string[];
  score: number;
}

interface FtsRow {
  id: string;
  content: string;
  tags: string;
  rank: number;
}

/**
 * Sanitize query for FTS5 MATCH syntax.
 * Splits into tokens and joins with OR for broad matching.
 */
function sanitizeFtsQuery(query: string): string {
  const tokens = query
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return "";

  // Join tokens with OR for broad matching
  return tokens.map((t) => `"${t}"`).join(" OR ");
}

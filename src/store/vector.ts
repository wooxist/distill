import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { resolveDbPath } from "./scope.js";
import type { KnowledgeScope } from "./types.js";

const EMBEDDING_DIM = 384;
const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

const FTS_SCHEMA = `
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  id UNINDEXED,
  content,
  tags
);
`;

const VEC_SCHEMA = `
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vec USING vec0(
  knowledge_id text primary key,
  embedding float[${EMBEDDING_DIM}] distance_metric=cosine
);
`;

// Shared embedder instance (lazy-loaded, singleton across all VectorStore instances)
let embedderPromise: Promise<EmbedFn> | null = null;

type EmbedFn = (text: string) => Promise<Float32Array>;

async function getEmbedder(): Promise<EmbedFn> {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      const extractor = await pipeline(
        "feature-extraction",
        EMBEDDING_MODEL,
        { dtype: "q8" as const },
      );
      return async (text: string): Promise<Float32Array> => {
        const output = await extractor(text, {
          pooling: "mean",
          normalize: true,
        });
        return new Float32Array(output.data as ArrayLike<number>);
      };
    })();
  }
  return embedderPromise;
}

/**
 * Vector store for semantic knowledge search.
 *
 * Dual-index: FTS5 for keyword search + sqlite-vec for semantic search.
 * Embedding model loaded lazily on first async call.
 */
export class VectorStore {
  private db: Database.Database;

  constructor(scope: KnowledgeScope, projectRoot?: string) {
    const dbPath = resolveDbPath(scope, projectRoot);
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");

    // Load sqlite-vec extension
    sqliteVec.load(this.db);

    // Create both tables
    this.db.exec(FTS_SCHEMA);
    this.db.exec(VEC_SCHEMA);
  }

  /** Index a knowledge chunk in both FTS5 and vector index */
  async index(id: string, content: string, tags: string[]): Promise<void> {
    // FTS5 index (sync)
    this.db
      .prepare(
        "INSERT OR REPLACE INTO knowledge_fts (id, content, tags) VALUES (?, ?, ?)",
      )
      .run(id, content, tags.join(" "));

    // Vector index (async — needs embedding)
    const embed = await getEmbedder();
    const embedding = await embed(content);
    this.db
      .prepare(
        "INSERT OR REPLACE INTO knowledge_vec (knowledge_id, embedding) VALUES (?, ?)",
      )
      .run(id, embedding);
  }

  /** Semantic search using vector similarity (KNN) */
  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    const embed = await getEmbedder();
    const queryEmbedding = await embed(query);

    const vecRows = this.db
      .prepare(
        `SELECT knowledge_id, distance
         FROM knowledge_vec
         WHERE embedding MATCH ?
         AND k = ?`,
      )
      .all(queryEmbedding, limit) as VecRow[];

    if (vecRows.length === 0) return [];

    // Fetch content from FTS table for the matched IDs
    const distanceMap = new Map(
      vecRows.map((r) => [r.knowledge_id, r.distance]),
    );
    const ids = vecRows.map((r) => r.knowledge_id);
    const placeholders = ids.map(() => "?").join(",");
    const ftsRows = this.db
      .prepare(
        `SELECT id, content, tags FROM knowledge_fts WHERE id IN (${placeholders})`,
      )
      .all(...ids) as FtsContentRow[];

    return ftsRows
      .map((row) => ({
        id: row.id,
        content: row.content,
        tags: row.tags.split(" ").filter(Boolean),
        score: 1 - (distanceMap.get(row.id) ?? 1), // cosine distance [0,2] → similarity [-1,1]
      }))
      .sort((a, b) => b.score - a.score);
  }

  /** Keyword search using FTS5 only (sync, no embedding needed) */
  ftsSearch(query: string, limit: number = 5): SearchResult[] {
    const sanitized = sanitizeFtsQuery(query);
    if (!sanitized) return [];

    const rows = this.db
      .prepare(
        `SELECT id, content, tags, rank
         FROM knowledge_fts
         WHERE knowledge_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
      )
      .all(sanitized, limit) as FtsRow[];

    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      tags: row.tags.split(" ").filter(Boolean),
      score: -row.rank,
    }));
  }

  /** Remove an entry from both indexes */
  remove(id: string): void {
    this.db.prepare("DELETE FROM knowledge_fts WHERE id = ?").run(id);
    this.db
      .prepare("DELETE FROM knowledge_vec WHERE knowledge_id = ?")
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

interface VecRow {
  knowledge_id: string;
  distance: number;
}

interface FtsContentRow {
  id: string;
  content: string;
  tags: string;
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
/** @internal Exported for testing */
export function sanitizeFtsQuery(query: string): string {
  const tokens = query
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return "";

  return tokens.map((t) => `"${t}"`).join(" OR ");
}

/** Reset the shared embedder (for testing) */
export function _resetEmbedder(): void {
  embedderPromise = null;
}

import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type {
  KnowledgeChunk,
  KnowledgeInput,
  KnowledgeScope,
  KnowledgeType,
} from "./types.js";
import { resolveDbPath } from "./scope.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS knowledge (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('pattern','preference','decision','mistake','workaround')),
  scope TEXT NOT NULL CHECK(scope IN ('global','project')),
  project TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  session_id TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK("trigger" IN ('pre_compact','session_end','manual')),
  source_timestamp TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  access_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_scope ON knowledge(scope);
CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge(project);
`;

/** Metadata store backed by SQLite */
export class MetadataStore {
  private db: Database.Database;

  constructor(scope: KnowledgeScope, projectRoot?: string) {
    const dbPath = resolveDbPath(scope, projectRoot);
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCHEMA);
  }

  /** Insert a new knowledge chunk, returns full chunk with generated id/timestamps */
  insert(input: KnowledgeInput): KnowledgeChunk {
    const now = new Date().toISOString();
    const id = randomUUID();

    const stmt = this.db.prepare(`
      INSERT INTO knowledge (id, content, type, scope, project, tags, session_id, "trigger", source_timestamp, confidence, access_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);

    stmt.run(
      id,
      input.content,
      input.type,
      input.scope,
      input.project,
      JSON.stringify(input.tags),
      input.source.session_id,
      input.source.trigger,
      input.source.timestamp,
      input.confidence,
      now,
      now
    );

    return {
      ...input,
      id,
      access_count: 0,
      created_at: now,
      updated_at: now,
    };
  }

  /** Get a knowledge chunk by ID */
  getById(id: string): KnowledgeChunk | null {
    const row = this.db
      .prepare("SELECT * FROM knowledge WHERE id = ?")
      .get(id) as RawRow | undefined;
    return row ? rowToChunk(row) : null;
  }

  /** Search by filters (non-vector, metadata only) */
  search(filters: {
    scope?: KnowledgeScope;
    type?: KnowledgeType;
    project?: string;
    limit?: number;
  }): KnowledgeChunk[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.scope) {
      conditions.push("scope = ?");
      params.push(filters.scope);
    }
    if (filters.type) {
      conditions.push("type = ?");
      params.push(filters.type);
    }
    if (filters.project) {
      conditions.push("project = ?");
      params.push(filters.project);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filters.limit ?? 20;

    const rows = this.db
      .prepare(
        `SELECT * FROM knowledge ${where} ORDER BY updated_at DESC LIMIT ?`
      )
      .all(...params, limit) as RawRow[];

    return rows.map(rowToChunk);
  }

  /** Increment access count (called on recall) */
  touch(id: string): void {
    this.db
      .prepare(
        `UPDATE knowledge SET access_count = access_count + 1, updated_at = ? WHERE id = ?`
      )
      .run(new Date().toISOString(), id);
  }

  /** Update scope (promote/demote) */
  updateScope(id: string, newScope: KnowledgeScope): void {
    this.db
      .prepare(`UPDATE knowledge SET scope = ?, updated_at = ? WHERE id = ?`)
      .run(newScope, new Date().toISOString(), id);
  }

  /** Delete a knowledge entry */
  delete(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM knowledge WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  /** Get aggregate statistics */
  stats(): {
    total: number;
    byType: Record<string, number>;
    byScope: Record<string, number>;
  } {
    const total = (
      this.db.prepare("SELECT COUNT(*) as cnt FROM knowledge").get() as {
        cnt: number;
      }
    ).cnt;

    const byType: Record<string, number> = {};
    const typeRows = this.db
      .prepare("SELECT type, COUNT(*) as cnt FROM knowledge GROUP BY type")
      .all() as { type: string; cnt: number }[];
    for (const r of typeRows) {
      byType[r.type] = r.cnt;
    }

    const byScope: Record<string, number> = {};
    const scopeRows = this.db
      .prepare("SELECT scope, COUNT(*) as cnt FROM knowledge GROUP BY scope")
      .all() as { scope: string; cnt: number }[];
    for (const r of scopeRows) {
      byScope[r.scope] = r.cnt;
    }

    return { total, byType, byScope };
  }

  /** Close the database connection */
  close(): void {
    this.db.close();
  }
}

// --- internal ---

interface RawRow {
  id: string;
  content: string;
  type: string;
  scope: string;
  project: string | null;
  tags: string;
  session_id: string;
  trigger: string;
  source_timestamp: string;
  confidence: number;
  access_count: number;
  created_at: string;
  updated_at: string;
}

function rowToChunk(row: RawRow): KnowledgeChunk {
  return {
    id: row.id,
    content: row.content,
    type: row.type as KnowledgeType,
    scope: row.scope as KnowledgeScope,
    project: row.project,
    tags: JSON.parse(row.tags),
    source: {
      session_id: row.session_id,
      timestamp: row.source_timestamp,
      trigger: row.trigger as KnowledgeChunk["source"]["trigger"],
    },
    confidence: row.confidence,
    access_count: row.access_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

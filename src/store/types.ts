/** Knowledge type classification */
export type KnowledgeType =
  | "pattern"
  | "preference"
  | "decision"
  | "mistake"
  | "workaround";

/** Knowledge scope */
export type KnowledgeScope = "global" | "project";

/** Trigger that caused extraction */
export type ExtractionTrigger = "pre_compact" | "session_end" | "manual";

/** A single knowledge chunk extracted from conversation */
export interface KnowledgeChunk {
  id: string;
  content: string;
  type: KnowledgeType;
  scope: KnowledgeScope;
  project: string | null;
  tags: string[];
  source: {
    session_id: string;
    timestamp: string;
    trigger: ExtractionTrigger;
  };
  confidence: number;
  access_count: number;
  created_at: string;
  updated_at: string;
}

/** Input for creating a new knowledge chunk (before ID/timestamps) */
export interface KnowledgeInput {
  content: string;
  type: KnowledgeType;
  scope: KnowledgeScope;
  project: string | null;
  tags: string[];
  source: {
    session_id: string;
    timestamp: string;
    trigger: ExtractionTrigger;
  };
  confidence: number;
}

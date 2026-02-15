import type { KnowledgeInput, KnowledgeChunk } from "../../src/store/types.ts";

export function makeKnowledgeInput(
  overrides: Partial<KnowledgeInput> = {},
): KnowledgeInput {
  return {
    content: "Default test content",
    type: "pattern",
    scope: "project",
    project: "test-project",
    tags: ["test"],
    source: {
      session_id: "test-session-001",
      timestamp: new Date().toISOString(),
      trigger: "manual",
    },
    confidence: 0.8,
    ...overrides,
  };
}

export function makeKnowledgeChunk(
  overrides: Partial<KnowledgeChunk> = {},
): KnowledgeChunk {
  const now = new Date().toISOString();
  return {
    id: "test-id-001",
    access_count: 0,
    created_at: now,
    updated_at: now,
    ...makeKnowledgeInput(),
    ...overrides,
  };
}

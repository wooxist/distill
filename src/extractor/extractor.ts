import Anthropic from "@anthropic-ai/sdk";
import {
  parseTranscript,
  formatTranscript,
  type ConversationTurn,
} from "./parser.js";
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionPrompt,
} from "./prompts.js";
import type {
  KnowledgeInput,
  KnowledgeScope,
  ExtractionTrigger,
} from "../store/types.js";

/** Raw extraction result from LLM */
interface RawExtraction {
  content: string;
  type: "pattern" | "preference" | "decision" | "mistake" | "workaround";
  scope: "global" | "project";
  tags: string[];
  confidence: number;
}

const MAX_TRANSCRIPT_CHARS = 100_000; // ~25k tokens, safe for Haiku

/**
 * Extract knowledge from a .jsonl transcript file.
 */
export async function extractKnowledge(opts: {
  transcriptPath: string;
  sessionId: string;
  trigger: ExtractionTrigger;
  projectName?: string;
  scopeOverride?: KnowledgeScope;
}): Promise<KnowledgeInput[]> {
  // 1. Parse transcript
  const turns = parseTranscript(opts.transcriptPath);
  if (turns.length < 2) return []; // need at least 1 exchange

  // 2. Format and truncate
  let formatted = formatTranscript(turns);
  if (formatted.length > MAX_TRANSCRIPT_CHARS) {
    formatted = truncateToRecent(turns, MAX_TRANSCRIPT_CHARS);
  }

  // 3. Call LLM
  const raw = await callLlm(formatted, opts.projectName);
  if (raw.length === 0) return [];

  // 4. Convert to KnowledgeInput
  const now = new Date().toISOString();
  return raw.map((r) => ({
    content: r.content,
    type: r.type,
    scope: opts.scopeOverride ?? r.scope,
    project: r.scope === "project" ? (opts.projectName ?? null) : null,
    tags: r.tags,
    source: {
      session_id: opts.sessionId,
      timestamp: now,
      trigger: opts.trigger,
    },
    confidence: r.confidence,
  }));
}

async function callLlm(
  formattedTranscript: string,
  projectName?: string
): Promise<RawExtraction[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is required for extraction"
    );
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildExtractionPrompt(formattedTranscript, projectName),
      },
    ],
  });

  // Extract text from response
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Parse JSON from response
  return parseExtractionResponse(text);
}

function parseExtractionResponse(text: string): RawExtraction[] {
  // Try to find JSON array in the response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    // Validate each entry
    return parsed.filter(
      (item): item is RawExtraction =>
        typeof item.content === "string" &&
        ["pattern", "preference", "decision", "mistake", "workaround"].includes(
          item.type
        ) &&
        ["global", "project"].includes(item.scope) &&
        Array.isArray(item.tags) &&
        typeof item.confidence === "number" &&
        item.confidence >= 0 &&
        item.confidence <= 1
    );
  } catch {
    return [];
  }
}

/**
 * Truncate transcript to fit within char limit, keeping recent turns.
 */
function truncateToRecent(
  turns: ConversationTurn[],
  maxChars: number
): string {
  const result: ConversationTurn[] = [];
  let total = 0;

  // Walk backwards, keeping recent turns
  for (let i = turns.length - 1; i >= 0; i--) {
    const entry = `[${turns[i].role.toUpperCase()}]\n${turns[i].text}\n\n---\n\n`;
    if (total + entry.length > maxChars) break;
    total += entry.length;
    result.unshift(turns[i]);
  }

  return formatTranscript(result);
}

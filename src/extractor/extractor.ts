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
import { loadConfig } from "../config.js";
import { readExistingDistillRules } from "./rules-reader.js";

/** Raw extraction result from LLM */
interface RawExtraction {
  content: string;
  type: "pattern" | "preference" | "decision" | "mistake" | "workaround" | "conflict";
  scope: "global" | "project";
  tags: string[];
  confidence: number;
}

/**
 * Extract knowledge from a .jsonl transcript file.
 */
export async function extractKnowledge(opts: {
  transcriptPath: string;
  sessionId: string;
  trigger: ExtractionTrigger;
  projectName?: string;
  scopeOverride?: KnowledgeScope;
  projectRoot?: string | null;
}): Promise<KnowledgeInput[]> {
  const config = loadConfig(opts.projectRoot);

  // 1. Parse transcript
  const turns = parseTranscript(opts.transcriptPath);
  if (turns.length < 2) return []; // need at least 1 exchange

  // 2. Format and truncate
  let formatted = formatTranscript(turns);
  if (formatted.length > config.max_transcript_chars) {
    formatted = truncateToRecent(turns, config.max_transcript_chars);
  }

  // 3. Read existing distill rules for conflict detection
  const existingRules = readExistingDistillRules(opts.projectRoot);

  // 4. Call LLM
  const raw = await callLlm(formatted, config.extraction_model, opts.projectName, existingRules);
  if (raw.length === 0) return [];

  // 5. Convert to KnowledgeInput
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

/** Generic LLM call — reused by extraction and crystallize */
export async function callLlm(
  formattedTranscript: string,
  model: string,
  projectName?: string,
  existingRules?: string,
): Promise<RawExtraction[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is required for extraction"
    );
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildExtractionPrompt(formattedTranscript, projectName, existingRules),
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
        ["pattern", "preference", "decision", "mistake", "workaround", "conflict"].includes(
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

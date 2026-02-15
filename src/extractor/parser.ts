import { readFileSync } from "node:fs";

/** A single conversational turn parsed from .jsonl */
export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
  timestamp?: string;
}

/** Raw .jsonl line structure (subset of fields we care about) */
interface JsonlEntry {
  type: string;
  message?: {
    role?: string;
    content?: JsonlContent[];
  };
  timestamp?: string;
}

type JsonlContent =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; name: string; input: unknown }
  | { type: "tool_result"; content: unknown };

/**
 * Parse a Claude Code .jsonl transcript into conversation turns.
 *
 * Extracts only user and assistant text content.
 * Skips tool_use, tool_result, thinking, system messages.
 */
export function parseTranscript(filePath: string): ConversationTurn[] {
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const turns: ConversationTurn[] = [];

  for (const line of lines) {
    let entry: JsonlEntry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // skip malformed lines
    }

    // Only process user/assistant messages
    if (entry.type !== "user" && entry.type !== "assistant") continue;

    const role = entry.type as "user" | "assistant";
    const message = entry.message;
    if (!message?.content) continue;

    // Extract text content only
    const textParts: string[] = [];
    for (const block of message.content) {
      if (block.type === "text" && "text" in block) {
        textParts.push(block.text);
      }
    }

    const text = textParts.join("\n").trim();
    if (text.length === 0) continue;

    turns.push({
      role,
      text,
      timestamp: entry.timestamp,
    });
  }

  return turns;
}

/**
 * Format conversation turns into a readable transcript for the LLM.
 */
export function formatTranscript(turns: ConversationTurn[]): string {
  return turns
    .map((t) => `[${t.role.toUpperCase()}]\n${t.text}`)
    .join("\n\n---\n\n");
}

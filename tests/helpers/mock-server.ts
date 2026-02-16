import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

/** Captured createMessage call for assertions */
export interface CapturedCall {
  messages: Array<{ role: string; content: { type: string; text?: string } }>;
  systemPrompt?: string;
  modelPreferences?: {
    hints?: Array<{ name: string }>;
    costPriority?: number;
    speedPriority?: number;
    intelligencePriority?: number;
  };
  maxTokens?: number;
}

/**
 * Create a duck-typed mock Server that only implements createMessage().
 * Production code only uses server.createMessage(), so this is sufficient.
 */
export function createMockServer(opts?: {
  response?: string | ((params: CapturedCall) => string);
  error?: Error;
  model?: string;
}): { server: Server; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const responseText = opts?.response ?? "[]";
  const modelName = opts?.model ?? "mock-model";

  const mock = {
    createMessage: async (params: CapturedCall) => {
      calls.push(params);

      if (opts?.error) {
        throw opts.error;
      }

      const text =
        typeof responseText === "function"
          ? responseText(params)
          : responseText;

      return {
        model: modelName,
        role: "assistant",
        content: { type: "text" as const, text },
        stopReason: "endTurn",
      };
    },
  };

  return {
    server: mock as unknown as Server,
    calls,
  };
}

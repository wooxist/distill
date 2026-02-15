#!/usr/bin/env node

/**
 * Distill hook handler for PreCompact and SessionEnd events.
 *
 * Receives hook event data via stdin (JSON), extracts knowledge
 * from the session transcript, and stores it.
 *
 * Usage: echo '{"session_id":"...","transcript_path":"..."}' | node distill-hook.js
 */

import { extractKnowledge } from "../extractor/extractor.js";
import { MetadataStore } from "../store/metadata.js";
import { VectorStore } from "../store/vector.js";
import { detectProjectRoot } from "../store/scope.js";
import type { ExtractionTrigger } from "../store/types.js";

interface HookInput {
  session_id: string;
  transcript_path: string;
  cwd?: string;
  hook_event_name?: string;
}

async function main() {
  // Read stdin
  const input = await readStdin();
  if (!input) {
    console.error("distill-hook: no input received on stdin");
    process.exit(1);
  }

  let hookData: HookInput;
  try {
    hookData = JSON.parse(input);
  } catch {
    console.error("distill-hook: invalid JSON on stdin");
    process.exit(1);
  }

  if (!hookData.session_id || !hookData.transcript_path) {
    console.error(
      "distill-hook: missing session_id or transcript_path"
    );
    process.exit(1);
  }

  // Determine trigger type from hook event name
  const trigger: ExtractionTrigger =
    hookData.hook_event_name === "PreCompact"
      ? "pre_compact"
      : "session_end";

  const projectRoot = hookData.cwd
    ? detectProjectRoot(hookData.cwd)
    : detectProjectRoot();
  const projectName = projectRoot?.split("/").pop() ?? undefined;

  console.error(
    `distill-hook: extracting from session ${hookData.session_id} (${trigger})`
  );

  try {
    const chunks = await extractKnowledge({
      transcriptPath: hookData.transcript_path,
      sessionId: hookData.session_id,
      trigger,
      projectName,
    });

    if (chunks.length === 0) {
      console.error("distill-hook: no knowledge extracted");
      return;
    }

    let saved = 0;
    for (const chunk of chunks) {
      try {
        const meta = new MetadataStore(chunk.scope, projectRoot ?? undefined);
        const vector = new VectorStore(chunk.scope, projectRoot ?? undefined);

        const inserted = meta.insert(chunk);
        vector.index(inserted.id, inserted.content, inserted.tags);

        meta.close();
        vector.close();
        saved++;
      } catch (err) {
        console.error(`distill-hook: failed to save chunk: ${err}`);
      }
    }

    console.error(
      `distill-hook: extracted ${chunks.length}, saved ${saved} knowledge chunks`
    );
  } catch (err) {
    console.error(`distill-hook: extraction failed: ${err}`);
    process.exit(1);
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data.trim()));

    // Timeout after 5 seconds if no stdin
    setTimeout(() => resolve(data.trim()), 5000);
  });
}

main().catch((err) => {
  console.error(`distill-hook: fatal error: ${err}`);
  process.exit(1);
});

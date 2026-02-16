import { MetadataStore } from "../store/metadata.js";
import { VectorStore } from "../store/vector.js";
import { detectProjectRoot } from "../store/scope.js";
import type { KnowledgeScope } from "../store/types.js";

export interface ScopeCallbackContext {
  scope: KnowledgeScope;
  meta: MetadataStore;
  vector?: VectorStore;
}

/**
 * Iterate over resolved scopes with automatic store lifecycle management.
 * Silently skips scopes that don't exist yet.
 */
export async function forEachScope(
  scopeParam: KnowledgeScope | undefined,
  projectRoot: string | null,
  callback: (ctx: ScopeCallbackContext) => Promise<void> | void,
  includeVector: boolean = false,
): Promise<void> {
  const scopes: KnowledgeScope[] = scopeParam
    ? [scopeParam]
    : projectRoot
      ? ["global", "project"]
      : ["global"];

  for (const scope of scopes) {
    try {
      const meta = new MetadataStore(scope, projectRoot ?? undefined);
      const vector = includeVector
        ? new VectorStore(scope, projectRoot ?? undefined)
        : undefined;

      await callback({ scope, meta, vector });

      meta.close();
      if (vector) {
        vector.close();
      }
    } catch {
      // scope may not exist yet — skip
    }
  }
}

/**
 * Resolve scope parameter and project root for tools.
 * Returns { scopes, projectRoot }.
 */
export function resolveScopeContext(
  scopeParam: KnowledgeScope | undefined,
): { scopes: KnowledgeScope[]; projectRoot: string | null } {
  const projectRoot = detectProjectRoot();
  const scopes: KnowledgeScope[] = scopeParam
    ? [scopeParam]
    : projectRoot
      ? ["global", "project"]
      : ["global"];
  return { scopes, projectRoot };
}

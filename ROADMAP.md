# Distill Roadmap

## Done

### MVP (Pre-Phase 1)

| Item | Commit |
|------|--------|
| TS MVP — MCP server, 5 tools (learn, recall, profile, digest, memory) | pre `f6ebfa3` |
| SQLite + FTS5 store (global/project dual scope) | pre `f6ebfa3` |
| .jsonl parser + transcript truncation | pre `f6ebfa3` |
| Rename "oh-my" prefix to "distill" | `f6ebfa3` |
| Extraction criteria redesign: unidirectional to bidirectional Decision Signals | `f6ebfa3` |
| Remove Korean examples, adopt semantic-based detection | `f6ebfa3` |
| PreCompact/SessionEnd auto-extraction hook (`src/hooks/distill-hook.ts`) | pre `f6ebfa3` |

### Phase 1: Rule Generation & Evolution (Complete)

| Item | Files |
|------|-------|
| Config system — per-module model selection (`.distill/config.json`) | `src/config.ts` |
| Extraction prompt context preservation (conclusion + WHY reasoning) | `src/extractor/prompts.ts` |
| Crystallize action — consolidate chunks into `distill-*.md` rule files | `src/extractor/crystallize.ts`, `src/tools/memory.ts` |
| Conflict detection — inject existing rules as context during extraction | `src/extractor/extractor.ts`, `src/extractor/rules-reader.ts` |
| Auto-crystallize threshold — trigger crystallize after N new chunks | `src/tools/learn.ts` |
| `distill_meta` table for tracking crystallize timestamps | `src/store/metadata.ts` |
| Unit tests — 65 tests covering all Phase 1 modules | `tests/` |
| MCP Sampling refactoring — remove API key dependency, use `server.createMessage()` | `src/extractor/extractor.ts`, `src/extractor/crystallize.ts`, `src/server.ts` |
| MCP Sampling tests — mock server, callLlm, extractKnowledge, crystallize, hook tests (+42 tests) | `tests/` |

**Key decisions in Phase 1:**

| Decision | Reasoning |
|----------|-----------|
| Per-module model selection | Haiku for frequent extraction (fast/cheap), Sonnet for infrequent crystallize (quality) |
| Config file (`.distill/config.json`) | Zero-config defaults, global → project merge priority |
| Manual + threshold auto-trigger for crystallize | Balances user control with automation |
| Conflict detection during extraction | Single Haiku call handles both extraction and conflict detection (no extra LLM call) |

---

## Phase 1.5: Knowledge Routing & Context Budget

### Goal

Prevent context bloat by routing crystallized knowledge to the right delivery mechanism instead of dumping everything into always-loaded rule files.

### Problem

Crystallize currently outputs ALL knowledge as `.claude/rules/distill-*.md` files. Rules are always loaded into context. As knowledge accumulates, rule files grow, context consumption increases, and returns diminish.

### Delivery Mechanisms

| Delivery | When to Use | Context Cost | Output Path |
|----------|-------------|-------------|-------------|
| **Rule** | High-frequency, always-needed patterns | Always loaded | `.claude/rules/distill-*.md` |
| **Knowledge store** | Low-frequency, query-triggered | On-demand (recall) | SQLite (existing) |
| **Skill** | Procedural "how-to" or workflow knowledge | Loaded on invocation | `.claude/skills/distill-*/SKILL.md` |
| **Subagent** | Complex multi-step tasks | Separate context | `.claude/agents/distill-*.yaml` |

### Tasks

1. Rule budget — cap total rule files at configurable limit (e.g., 5 files, ~2K tokens total)
2. Graduation logic in crystallize — classify each rule group:
   - High-confidence + high-frequency → rule (always-loaded)
   - Procedural/how-to or workflow → skill (loaded on invocation, frontmatter controls invocability)
   - Complex multi-step → subagent definition
   - Low-confidence or niche → keep in knowledge store only (recall on demand)
3. Skill generator — output `.claude/skills/distill-*/SKILL.md` from procedural/workflow knowledge
4. Staleness decay — rules with 0 `access_count` after N sessions get demoted back to store
5. Context budget dashboard — `profile` tool shows total rule token count + budget usage

### Open Questions

- Token counting strategy (approximate char-based vs tokenizer)
- Graduation thresholds (how many accesses before promoting to rule?)
- Skill template format (frontmatter: `disable-model-invocation: true` for user-only skills)
- Whether subagent generation is feasible in Phase 1.5 or should be deferred
- SessionStart hook for auto-learn pending extractions

---

## Phase 2: User Environment Awareness

### Goal

Understand the user's entire `.claude/` setup (not just Distill-generated rules) and detect conflicts.

### Scope

| Target | Path | Purpose |
|--------|------|---------|
| Rules | `.claude/rules/*.md` | User-authored rules |
| Skills | `.claude/skills/*/SKILL.md` | Skill definitions (triggers, uses) |
| Agents | `.claude/agents/*.yaml` | Agent definitions |

### Tasks

1. `.claude/` scanner — collect inventory of rules, skills, agents
2. Provide full user rule context during extraction (Distill rules + user rules)
3. Crystallize suggests modifications when conflicting with user rules (no auto-edit)
4. Analyze relationships between decisions and skills/agents
5. E2E simulation — run full pipeline (learn → crystallize → conflict detect) with real `.jsonl` transcripts
6. Wiki/docs ingestion — `ingest(path)` tool to build knowledge from `wiki/` or markdown directories

### Open Questions

- Whether to allow direct modification of user rules (only `distill-*.md` vs user rules too)
- Scope of skill metadata modification (adding/changing triggers, etc.)
- Inventory caching strategy
- Consider vector DB for semantic search (replace FTS5)
- Wiki format support: plain markdown? MDX? Confluence export?
- Incremental wiki update: re-scan only changed files?

---

## Phase 3: Team Sharing

### Goal

Mechanism to promote personal rules to team-wide rules.

### Considerations

- Whether to git-commit project-scope Distill rules (applies to entire team)
- Cross-member conflict resolution: A prefers X, B prefers Y — consensus mechanism
- PR-based proposals: crystallize → rule file change → create PR → team review
- Personal vs team rule separation (personal overrides on same topic?)

---

## Decision Log

| Decision | Reasoning |
|----------|-----------|
| Personal-first approach | Team sharing mechanism has high complexity; validate with personal use first |
| No Entire integration needed | Distill hook already operates independently from Claude Code events |
| Phase 1: detect conflicts in Distill rules only | Full `.claude/` environment awareness deferred to Phase 2 |
| Bidirectional Decision Signals | Unidirectional (user→AI corrections only) misses AI→user corrections |
| Semantic-based detection | Keyword matching fails in multilingual conversations; semantic approach is universal |
| Per-module model separation | Different quality/cost tradeoffs per pipeline stage |
| Knowledge routing | Rules are always-loaded context; uncontrolled growth degrades performance. Route by delivery mechanism based on knowledge type and frequency |
| MCP Sampling over API key | Claude Max/Teams users shouldn't need separate API credits. MCP sampling uses existing subscription via `server.createMessage()` |
| Commands deprecated → Skills | Claude Code deprecated commands (merged into skills). Skills support frontmatter (`disable-model-invocation: true`) for user-only invocation, replacing command use cases |

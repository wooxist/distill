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

**Key decisions in Phase 1:**

| Decision | Reasoning |
|----------|-----------|
| Per-module model selection | Haiku for frequent extraction (fast/cheap), Sonnet for infrequent crystallize (quality) |
| Config file (`.distill/config.json`) | Zero-config defaults, global → project merge priority |
| Manual + threshold auto-trigger for crystallize | Balances user control with automation |
| Conflict detection during extraction | Single Haiku call handles both extraction and conflict detection (no extra LLM call) |

---

## Phase 2: User Environment Awareness

### Goal

Understand the user's entire `.claude/` setup (not just Distill-generated rules) and detect conflicts.

### Scope

| Target | Path | Purpose |
|--------|------|---------|
| Rules | `.claude/rules/*.md` | User-authored rules |
| Skills | `.claude/skills/*/SKILL.md` | Skill definitions (triggers, uses) |
| Commands | `.claude/commands/*.md` | Command definitions |
| Agents | `.claude/agents/*.yaml` | Agent definitions |

### Tasks

1. `.claude/` scanner — collect inventory of rules, skills, commands, agents
2. Provide full user rule context during extraction (Distill rules + user rules)
3. Crystallize suggests modifications when conflicting with user rules (no auto-edit)
4. Analyze relationships between decisions and skills/agents

### Open Questions

- Whether to allow direct modification of user rules (only `distill-*.md` vs user rules too)
- Scope of skill metadata modification (adding/changing triggers, etc.)
- Inventory caching strategy
- Consider vector DB for semantic search (replace FTS5)

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

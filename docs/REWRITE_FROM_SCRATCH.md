# Vais Monitor Rewrite From Scratch

Status: handoff plan for a new session

## Goal

Rebuild Vais Monitor as the official Vais reference app. The purpose is not to
salvage the legacy implementation line-by-line. The purpose is to prove that an
AI agent can read the official Vais documentation and build a real app through
small verified slices.

## Why Rewrite

The existing implementation was useful during earlier compiler phases, but it is
not clean enough to be the reference app now:

- Some project instructions still referenced legacy syntax such as `F`, `S`,
  `EN`, `EL`, `R`, and `U`.
- Generated `.ll` files, local DB files, binary artifacts, `dist`, and
  `node_modules` are mixed into the working tree.
- Several parts were written before the current enum layout, pointer/i64, public
  claim, playground, and AI-doc sync contracts were finalized.
- A reference app must be smaller, reproducible, and tied to named gates.

## Source Documents

Start every implementation session by reading:

- `/Users/sswoo/study/projects/vais/compiler/docs/ai/LLM_LANGUAGE_CARD.md`
- `/Users/sswoo/study/projects/vais/compiler/docs/ai/AI_DEVELOPER_GUIDE.md`
- `/Users/sswoo/study/projects/vais/compiler/docs/ai/REFERENCE_APP_CONTRACT.md`
- `/Users/sswoo/study/projects/vais/compiler/docs/LANGUAGE_SPEC.md`
- `/Users/sswoo/study/projects/vais/compiler/PUBLIC_STATUS.md`

Do not rely on model memory for Vais syntax.

## Preserve Before Deleting

Before removing legacy implementation files, create a preservation point:

```bash
cd /Users/sswoo/study/projects/vais-apps/monitor
git status --short --branch
git tag legacy-monitor-before-reference-rewrite
```

If a tag with that name already exists, create a dated tag:

```bash
git tag legacy-monitor-before-reference-rewrite-$(date +%Y%m%d)
```

## Keep

Keep these as planning or gate assets:

- `PRD.md`
- `ROADMAP.md` as historical context only
- `docs/REWRITE_FROM_SCRATCH.md`
- `docs/NEW_SESSION_HANDOFF.md`
- `docs/PERFORMANCE_TESTING.md`
- `bench/rss_plateau.sh`
- `.gitignore`
- `CLAUDE.md`

## Delete Or Recreate

These are candidates for deletion before the rewrite:

- `server/src/*.ll`
- `server/monitor-server`
- `server/vais-monitor.db*`
- root `vais-monitor.db*`
- `web/dist`
- `web/node_modules`
- generated caches such as `.vais-cache`
- legacy `server/src/*.vais` and `web/app/*.vaisx` files once the preservation
  tag exists

Do not delete files until the preservation point exists.

## New App Shape

Build a small vertical slice first:

1. Health endpoint
2. Service model
3. SQLite-backed service repository
4. List/create service API
5. Web page showing services and a create form
6. One integration test or scripted smoke test
7. RSS plateau gate after a runnable binary exists

Only after this slice is stable should the app add logs, alerts, incidents,
graph, AI/RAG, auth, WebSocket, and GraphQL.

## Required Vais Feature Coverage

The reference app must eventually exercise:

- canonical `fn`, `struct`, `enum`, `use`, and `pub` spellings
- `Option<T>` for lookup/missing values
- `Result<T, E>` for recoverable API and DB failures
- `match` over `Option` and `Result`
- explicit bool/string/pointer/raw-address boundaries
- current enum layout assumptions through real compiler/codegen gates
- server route handling
- DB schema/migration path
- web UI build path
- playground/docs extractable examples

## Forbidden In New Code

- No legacy public syntax examples: `F`, `S`, `EN`, `EL`, `R`, `U`
- No generated `.ll` committed as source
- No committed local DB/WAL/SHM files
- No committed `node_modules` or `dist`
- No unchecked stubs that are presented as complete product behavior
- No public claim that exceeds `PUBLIC_STATUS.md`

## Phase Plan

### Phase 0: Reset And Skeleton

- Create preservation tag.
- Remove generated artifacts.
- Replace legacy server/web implementation with empty skeletons.
- Add minimal README for build/test commands.

Done when `git status` shows only intentional source/docs changes.

### Phase 1: Compiler-First Server Slice

- Implement `server/src/main.vais` with health response and one service type.
- Use `Result<T, E>` for handlers.
- Use `Option<T>` for lookup.
- Build with `server/build.sh --ir-only`.

Done when IR emission succeeds from a clean cache.

### Phase 2: DB Slice

- Add service schema and minimal repository.
- Add create/list/get-by-id flow.
- Keep DB claims scoped to the gate that actually runs.

Done when the server slice compiles and the DB smoke is reproducible.

### Phase 3: Web Slice

- Rebuild `web/app` with one services page and a create form.
- Avoid claiming full browser-only compiler behavior.
- Keep API integration explicit.

Done when `npm run build` succeeds.

### Phase 4: End-To-End Gate

- Add a script that builds server, builds web, starts server, hits health, runs
  one CRUD smoke, and stops the server.

Done when one command verifies the full vertical slice.

### Phase 5: Promote To Official Reference App

- Update the compiler repo AI docs to name this app as the current reference app.
- Add monitor gates to the relevant CI or documented manual gate.
- Link the app from public docs only after gates pass.

## Verification Commands

Compiler repo:

```bash
cd /Users/sswoo/study/projects/vais/compiler
cargo fmt --all -- --check
cargo test -p vais-types --test inference_unification_tests -- --nocapture
cargo test -p vaisc --test e2e -- --nocapture
node scripts/check-public-claims.mjs
node scripts/check-ai-docs-sync.mjs
```

Monitor repo:

```bash
cd /Users/sswoo/study/projects/vais-apps/monitor
cd server && ./build.sh --ir-only
cd ../web && npm run build
```

RSS gate after a runnable binary exists:

```bash
cd /Users/sswoo/study/projects/vais-apps/monitor
DURATION_SEC=120 WARMUP_SEC=20 THRESHOLD_MB=15 ./bench/rss_plateau.sh
```

## Completion Definition

The rewrite is complete only when a new AI session can:

1. Read official Vais docs.
2. Build the monitor app from a clean checkout.
3. Run the full vertical slice gate.
4. Explain which claims are certified and which remain evidence-scoped.

# monitor

Current clean rewrite for a Vais reference app. The repository was intentionally
reset on 2026-05-15 so new code starts from the current public language and
compiler baseline.

## Why

The previous implementation reached 51 completed tasks across 9 phases but
final server linking failed because `vais-server` runtime symbols
(`server_listen*`, `db_*`, `ws_*`, ...) are not yet implemented. The legacy
tree also predated the current Vais language baseline (canonical `fn`/`struct`/
`enum`, Result/Option/match, generic enum layout with i32 tag, strict type
boundaries).

Rather than patch around missing runtime symbols, the project is being rebuilt
from a clean vertical slice using the current official Vais docs.

## Current slice

- `server/src/main.vais`: pure Vais domain core using `fn`, `struct`, `enum`,
  `Option<T>`, `Result<T, E>`, and `match`.
- `server/build.sh --ir-only`: emits LLVM IR to a temporary directory without
  linking unfinished server/db/ws runtime symbols.
- `playground/monitor.vais`: playground copy of the same domain source. Keep it
  synchronized with `scripts/sync-playground-example.sh`.
- `web/`: static Vite shell that displays the same seed monitor task state.

## Verify

```bash
scripts/check-reference-gates.sh
```

After committing a change, verify the committed tree:

```bash
scripts/check-clean-checkout.sh
```

## Recover the previous tree

```bash
git checkout legacy-before-rewrite-2026-05-15
```

The tag points at commit `d78e67f` ("docs: prepare monitor reference rewrite
handoff"). Full history including PRD.md, ROADMAP.md, and the legacy
server/web sources is preserved in git history.

## Required reading before new code

Read in this order before writing any Vais:

1. `/Users/sswoo/study/projects/vais/compiler/docs/ai/LLM_LANGUAGE_CARD.md`
2. `/Users/sswoo/study/projects/vais/compiler/docs/LANGUAGE_SPEC.md`
3. `/Users/sswoo/study/projects/vais/compiler/PUBLIC_STATUS.md`
4. `/Users/sswoo/study/projects/vais/compiler/docs/ai/AI_DEVELOPER_GUIDE.md`
5. `/Users/sswoo/study/projects/vais/compiler/docs/ai/REFERENCE_APP_CONTRACT.md`
6. `docs/GOAL.md`

## Next

Per `REFERENCE_APP_CONTRACT.md`, broaden only after the current named gates pass.
The next practical step is a clean-checkout CI or automation wrapper for
`scripts/check-clean-checkout.sh` when this repo has a remote workflow surface.
HTTP and DB adapters stay blocked until their runtime symbols have named
reproducible gates for this app shape.

Do not reintroduce legacy `F`/`S`/`EN`/`EL`/`R`/`U` syntax, do not commit
`.ll` / `.db` / `node_modules` / `dist`, and do not claim completion beyond
named gates.

# Claude Code Handoff

Read the current official Vais docs before writing source:

1. `/Users/sswoo/study/projects/vais/compiler/docs/ai/LLM_LANGUAGE_CARD.md`
2. `/Users/sswoo/study/projects/vais/compiler/docs/LANGUAGE_SPEC.md`
3. `/Users/sswoo/study/projects/vais/compiler/PUBLIC_STATUS.md`
4. `/Users/sswoo/study/projects/vais/compiler/docs/ai/AI_DEVELOPER_GUIDE.md`
5. `/Users/sswoo/study/projects/vais/compiler/docs/ai/REFERENCE_APP_CONTRACT.md`

This repository was reset on 2026-05-15. Do not restore the legacy implementation
unless explicitly asked. The old tree is preserved at
`legacy-before-rewrite-2026-05-15`.

## Current Slice

- `server/src/main.vais` is a pure domain core using canonical `fn`, `struct`,
  `enum`, `Option<T>`, `Result<T, E>`, and `match`.
- `server/build.sh --ir-only` is the certified server gate for this repo.
- `playground/monitor.vais` must stay byte-for-byte synchronized with
  `server/src/main.vais`; run `scripts/sync-playground-example.sh` after source
  changes.
- `web/` is a static Vite shell for the same seed state.
- `scripts/check-reference-gates.sh` is the root verification command.
- `scripts/check-clean-checkout.sh` verifies the committed tree from a temporary
  git worktree.
- `docs/GOAL.md` defines the acceptance rule for broadening the reference app.
- `docs/RUNTIME_BOUNDARY.md` and `scripts/check-runtime-boundary.sh` define the
  blocked HTTP/DB/WS runtime surface.

Do not call unfinished `server_listen*`, `db_*`, or `ws_*` runtime symbols. Do
not commit `.ll`, `.db`, `node_modules`, or `dist` artifacts.

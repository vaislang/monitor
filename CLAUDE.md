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
- `web/` is a static Vite shell for the same seed state.

Do not call unfinished `server_listen*`, `db_*`, or `ws_*` runtime symbols. Do
not commit `.ll`, `.db`, `node_modules`, or `dist` artifacts.

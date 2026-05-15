# monitor (reset)

Working tree intentionally cleared on 2026-05-15.

## Why

The previous implementation reached 51 completed tasks across 9 phases but
final server linking failed because `vais-server` runtime symbols
(`server_listen*`, `db_*`, `ws_*`, ...) are not yet implemented. The legacy
tree also predated the current Vais language baseline (canonical `fn`/`struct`/
`enum`, Result/Option/match, generic enum layout with i32 tag, strict type
boundaries).

Rather than patch around missing runtime symbols, the project is being rebuilt
from a clean vertical slice using the current official Vais docs.

## Recover the previous tree

```bash
git checkout legacy-before-rewrite-2026-05-15
```

The tag points at commit `d78e67f` ("docs: prepare monitor reference rewrite
handoff"). Full history including PRD.md, ROADMAP.md, and the legacy
server/web sources is preserved on `master`.

## Required reading before new code

Read in this order before writing any Vais:

1. `/Users/sswoo/study/projects/vais/compiler/docs/ai/LLM_LANGUAGE_CARD.md`
2. `/Users/sswoo/study/projects/vais/compiler/docs/LANGUAGE_SPEC.md`
3. `/Users/sswoo/study/projects/vais/compiler/PUBLIC_STATUS.md`
4. `/Users/sswoo/study/projects/vais/compiler/docs/ai/AI_DEVELOPER_GUIDE.md`
5. `/Users/sswoo/study/projects/vais/compiler/docs/ai/REFERENCE_APP_CONTRACT.md`

## Next

Per `REFERENCE_APP_CONTRACT.md`, the suggested shape is a small task/notes
service exercising list / detail / create / update / delete with Result-typed
validation and Option-typed lookups. Build the smallest vertical slice first
and verify against the named compiler gates before broadening scope.

Do not reintroduce legacy `F`/`S`/`EN`/`EL`/`R`/`U` syntax, do not commit
`.ll` / `.db` / `node_modules` / `dist`, and do not claim completion beyond
named gates.

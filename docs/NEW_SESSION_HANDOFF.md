# New Session Handoff

Use this prompt for the next AI session.

```text
You are working in /Users/sswoo/study/projects/vais-apps/monitor.

Goal:
Rebuild Vais Monitor from scratch as the official Vais reference app. Do not
continue the legacy implementation directly.

Before coding, read:
- /Users/sswoo/study/projects/vais-apps/monitor/CLAUDE.md
- /Users/sswoo/study/projects/vais-apps/monitor/docs/REWRITE_FROM_SCRATCH.md
- /Users/sswoo/study/projects/vais/compiler/docs/ai/LLM_LANGUAGE_CARD.md
- /Users/sswoo/study/projects/vais/compiler/docs/ai/AI_DEVELOPER_GUIDE.md
- /Users/sswoo/study/projects/vais/compiler/docs/ai/REFERENCE_APP_CONTRACT.md
- /Users/sswoo/study/projects/vais/compiler/docs/LANGUAGE_SPEC.md
- /Users/sswoo/study/projects/vais/compiler/PUBLIC_STATUS.md

Rules:
- Preserve current git history first with a legacy tag.
- Remove generated artifacts before rewriting.
- Do not use legacy public Vais syntax such as F, S, EN, EL, R, or U.
- Use current syntax: fn, struct, enum, use, pub, Result<T, E>, Option<T>,
  match, explicit conversions, and the current compact control forms listed in
  the language spec.
- Build one verified vertical slice before adding features.
- Do not claim DB/server/web/product completion beyond named gates.

First tasks:
1. Create a preservation tag.
2. Remove generated artifacts and legacy implementation files listed in
   docs/REWRITE_FROM_SCRATCH.md.
3. Add a minimal server health endpoint using current Vais syntax.
4. Run `cd server && ./build.sh --ir-only`.
5. Add the smallest web shell only after the server slice compiles.

Completion target for the first session:
- Clean skeleton committed.
- Server health slice compiles to IR.
- Web skeleton build command is documented, even if not fully implemented.
```

# Vais Monitor

AI-facing project notes for the Vais Monitor reference app rewrite.

## Current Status

This repository currently contains a legacy monitor implementation from an older
Vais development phase. Do not treat the existing app code as the canonical
reference implementation.

The next implementation pass should rebuild the app from a clean vertical slice
using the current official Vais docs:

- `/Users/sswoo/study/projects/vais/compiler/docs/ai/LLM_LANGUAGE_CARD.md`
- `/Users/sswoo/study/projects/vais/compiler/docs/ai/AI_DEVELOPER_GUIDE.md`
- `/Users/sswoo/study/projects/vais/compiler/docs/ai/REFERENCE_APP_CONTRACT.md`
- `/Users/sswoo/study/projects/vais/compiler/docs/LANGUAGE_SPEC.md`
- `/Users/sswoo/study/projects/vais/compiler/PUBLIC_STATUS.md`

## Rewrite Rule

Preserve the current git history, then remove generated artifacts and rewrite the
app incrementally. Do not carry forward old syntax or unchecked stubs just
because they exist in the legacy tree.

Current public Vais syntax for new code:

- Use `fn`, `struct`, `enum`, `trait`, `impl`, `type`, `use`, and `pub` where
  available.
- Compact control forms such as `I`, `L`, `LF`, `LW`, `B`, `C`, and `D` remain
  valid where the language spec names them.
- Use `Result<T, E>`, `Option<T>`, `match`, and explicit conversion boundaries.
- Do not use old public examples based on `F`, `S`, `EN`, `EL`, `R`, or `U`.

## Project Intent

Vais Monitor should become the official end-to-end reference app for:

- Vais language syntax and type rules
- Vais compiler native build flow
- DB/schema usage
- Server API flow
- VaisX/web UI flow
- Runtime and memory stability checks
- AI-agent onboarding using official docs only

## Local Gates

Use these gates during the rewrite, expanding them only when the narrow slice
passes:

```bash
# compiler repo
cd /Users/sswoo/study/projects/vais/compiler
cargo fmt --all -- --check
cargo test -p vais-types --test inference_unification_tests -- --nocapture
cargo test -p vaisc --test e2e -- --nocapture
node scripts/check-public-claims.mjs
node scripts/check-ai-docs-sync.mjs

# monitor repo
cd /Users/sswoo/study/projects/vais-apps/monitor
cd server && ./build.sh --ir-only
cd ../web && npm run build
```

See `docs/REWRITE_FROM_SCRATCH.md` and `docs/NEW_SESSION_HANDOFF.md` before
starting implementation.

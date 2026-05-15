# New Session Handoff

Start here:

```bash
cd /Users/sswoo/study/projects/vais-apps/monitor
git status --short --branch
scripts/check-reference-gates.sh
```

After committing changes, run:

```bash
scripts/check-clean-checkout.sh
```

The server slice is intentionally IR-only. It validates current Vais language
surface without pretending that DB/server/ws runtime symbols are ready for this
reference app.

`playground/monitor.vais` is a synchronized copy of `server/src/main.vais`. If
the server source changes, run `scripts/sync-playground-example.sh` before the
reference gates.

The current source of truth for language and public claims is the sibling
compiler repository:

- `/Users/sswoo/study/projects/vais/compiler/docs/ai/LLM_LANGUAGE_CARD.md`
- `/Users/sswoo/study/projects/vais/compiler/docs/LANGUAGE_SPEC.md`
- `/Users/sswoo/study/projects/vais/compiler/PUBLIC_STATUS.md`
- `docs/GOAL.md`

If compiler behavior and docs disagree, stop and fix the compiler or docs before
adding fallback syntax here.

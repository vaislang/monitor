# Monitor Roadmap

## Done

- Reset legacy implementation and preserved it at
  `legacy-before-rewrite-2026-05-15`.
- Added the first current-syntax Vais domain slice under `server/src/main.vais`.
- Added IR-only server validation through `server/build.sh --ir-only`.
- Added a small Vite web shell under `web/`.
- Added `scripts/check-ir-layout.sh` to verify `%Option` and `%Result` use the
  canonical i32-tag IR layout.
- Added `playground/monitor.vais` and a sync/check path so the playground sample
  cannot silently drift from the server domain source.

## Next

1. Add CI or automation that runs `scripts/check-reference-gates.sh` from a
   clean checkout when this repo has a remote workflow surface.
2. Add an HTTP adapter only after the server runtime symbols are promoted into a
   reproducible main-branch gate.
3. Add DB persistence only after the DB runtime path has a named gate for this
   app shape.

## Completion Rule

Do not call this app complete until language/compiler, DB, server, web, docs,
and playground gates are all named and reproducible from a clean checkout.

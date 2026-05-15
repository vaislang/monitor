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
- Added `scripts/check-clean-checkout.sh` and `docs/GOAL.md` so committed work
  has a clean-checkout acceptance path.
- Added `scripts/check-runtime-boundary.sh` and `docs/RUNTIME_BOUNDARY.md` so
  uncertified HTTP/DB/WS calls cannot silently re-enter the app source.
- Added `.github/workflows/reference-gates.yml`, `scripts/check-prereqs.sh`, and
  `docs/CI.md` to make hosted CI setup explicit.
- Connected `origin` to `https://github.com/vaislang/monitor` and verified the
  hosted `Monitor Reference Gates` workflow passes.

## Next

1. Add an HTTP adapter only after the server runtime symbols are promoted into a
   reproducible main-branch gate.
2. Add DB persistence only after the DB runtime path has a named gate for this
   app shape.

## Completion Rule

Do not call this app complete until language/compiler, DB, server, web, docs,
and playground gates are all named and reproducible from a clean checkout.

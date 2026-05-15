# Monitor Roadmap

## Done

- Reset legacy implementation and preserved it at
  `legacy-before-rewrite-2026-05-15`.
- Added the first current-syntax Vais domain slice under `server/src/main.vais`.
- Added IR-only server validation through `server/build.sh --ir-only`.
- Added a small Vite web shell under `web/`.

## Next

1. Add a compiler-backed fixture test that checks the emitted IR keeps `%Option`
   and `%Result` on the canonical i32-tag layout.
2. Add a playground example generated from the same task-domain source.
3. Add an HTTP adapter only after the server runtime symbols are promoted into a
   reproducible main-branch gate.
4. Add DB persistence only after the DB runtime path has a named gate for this
   app shape.

## Completion Rule

Do not call this app complete until language/compiler, DB, server, web, docs,
and playground gates are all named and reproducible from a clean checkout.

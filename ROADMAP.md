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
- Added `scripts/check-adapter-readiness.sh` and
  `docs/ADAPTER_READINESS.md` so HTTP/DB adapter promotion has an explicit
  upstream evidence gate instead of relying on inference from individual package
  smokes.
- Refreshed the domain source for the current compiler by avoiding deprecated
  single-character generic parameter names and by using return-based match arms
  where scalar `Result` match expressions still expose invalid LLVM phi output.
- Updated the IR layout gate to check the current structural i32-tag
  `Option`/`Result` signatures without rejecting compact non-generic enum
  layout for `TaskState`.
- Added `server/build.sh --native` and included it in
  `scripts/check-reference-gates.sh` so the pure Vais domain slice now builds
  and executes, not only emits IR.
- Added `server/src/http_adapter.vais` and
  `scripts/check-http-adapter.sh` to certify the first monitor-specific HTTP
  runtime slice: listener open/close through `__tcp_listen` and `__tcp_close`.
- Narrowed `scripts/check-runtime-boundary.sh` so those two HTTP listener
  lifecycle symbols are allowed only in the dedicated adapter fixture; DB, WS,
  request handling, and broader server symbols remain blocked.
- Added `server/src/http_request.vais` and
  `scripts/check-http-request.sh` to certify the monitor-specific HTTP request
  parsing/routing slice. The fixture parses fixed raw HTTP requests through
  `__strlen`, `__find_header_end`, `__parse_request`, `__str_eq`, `__malloc`,
  and `__free` and routes them to monitor-specific route codes without
  starting a long-running server. The runtime parser is called through its
  explicit C ABI: a 64-byte `VaisRequest` output buffer is allocated, the
  parser writes into it through an out-pointer, and fields are read via the
  built-in `load_i64`. Vais string literals cross the C boundary through
  explicit `as i64` casts so the parser never receives a Vais fat string in a
  pointer slot.
- Narrowed `scripts/check-runtime-boundary.sh` further so each fixture has an
  exact per-file allowlist; broader HTTP, DB, and WS symbols remain blocked
  across `server/src` and `playground`.
- Added `server/src/db_persistence.vais` and
  `scripts/check-db-persistence.sh` to certify the first monitor-specific DB
  persistence slice: it opens a SQLite file database, creates the
  `monitor_tasks` table, inserts one row through prepared statements, verifies
  `__sqlite_last_insert_rowid` and `__sqlite_changes`, closes the connection,
  reopens the file, and confirms the persisted row through a `SELECT
  COUNT(*)/SUM(priority)/SUM(title_len)` query. The fixture exercises only
  `__sqlite_open`, `__sqlite_close`, `__sqlite_exec`, `__sqlite_prepare`,
  `__sqlite_bind_int`, `__sqlite_bind_text`, `__sqlite_step`,
  `__sqlite_column_int`, `__sqlite_finalize`, `__sqlite_last_insert_rowid`,
  and `__sqlite_changes` through their explicit C ABI (Vais string literals
  cross the boundary through `as i64` casts).
- Narrowed `scripts/check-runtime-boundary.sh` so the SQLite symbol allowlist
  applies only to `server/src/db_persistence.vais`; other DB symbols and any
  WS or expanded HTTP runtime symbols remain blocked across `server/src` and
  `playground`.

## Next

1. Add a fixture for HTTP response writing or client accept once a named
   upstream gate covers the exact runtime symbols.
2. Broaden DB persistence (query helpers, multiple rows, schema migration)
   only after a new monitor-specific fixture certifies the additional
   `__sqlite_*` surface required.
3. Replace the static TypeScript task state with data produced through the Vais
   adapter path.

## Completion Rule

Do not call this app complete until language/compiler, DB, server, web, docs,
and playground gates are all named and reproducible from a clean checkout.

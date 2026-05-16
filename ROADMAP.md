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
- Added `server/src/http_response.vais` and
  `scripts/check-http-response.sh` to certify the monitor-specific HTTP
  response loopback slice. The fixture completes one deterministic in-process
  HTTP response roundtrip on `127.0.0.1` from the small deterministic high-port
  range `39181..39199`: it opens a localhost listener, connects a client to
  `127.0.0.1`, accepts the connection, sends one fixed monitor HTTP response
  from the accepted server fd, receives it on the client fd (possibly across
  multiple recv calls), byte-verifies the exact response bytes through the
  built-in `load_byte` against the expected literal, and closes every opened
  fd on every success and error path. The fixture exercises only
  `__tcp_listen`, `__tcp_connect`, `__tcp_accept`, `__tcp_send`, `__tcp_recv`,
  `__tcp_close`, `__strlen`, `__malloc`, and `__free` through their explicit
  C ABI (Vais string literals cross the boundary through `as i64` casts) and
  does not start a long-running server.
- Narrowed `scripts/check-runtime-boundary.sh` so the HTTP response symbol
  allowlist applies only to `server/src/http_response.vais`; other `__tcp_*`,
  HTTP, DB, and WS runtime symbols remain blocked across `server/src` and
  `playground`.
- Added `server/src/http_response_parse.vais` and
  `scripts/check-http-response-parse.sh` to certify the monitor-specific HTTP
  response parsing slice. The fixture parses two fixed raw HTTP response
  strings through `__parse_response`, verifies the 64-byte `VaisResponse` C
  out-pointer layout via `load_i64`, asserts the status code, `HTTP/1.1`
  version, status text, body length, and exact body bytes for a `200 OK`
  JSON response and a `404 Not Found` response, and walks the
  `header_items` array (16 bytes per entry) to confirm `Content-Type`,
  `Content-Length`, and `Connection` header names and values. The fixture
  exercises only `__strlen`, `__parse_response`, `__str_eq`, `__malloc`, and
  `__free` through their explicit C ABI: Vais string literals cross the C
  boundary through `as i64` casts, and the body slice (which is not
  null-terminated and aliases the input buffer) is byte-copied into a fresh
  null-terminated buffer before equality comparison so the raw response
  buffer is never freed.
- Narrowed `scripts/check-runtime-boundary.sh` so the HTTP response parsing
  allowlist applies only to `server/src/http_response_parse.vais`; other HTTP
  runtime, `__tcp_*`, DB, and WS runtime symbols remain blocked across
  `server/src` and `playground`.
- Added `server/src/http_request_response_loop.vais` and
  `scripts/check-http-request-response-loop.sh` to certify the
  monitor-specific persistent request-response loop slice. The fixture
  completes one bounded in-process HTTP request-response cycle on
  `127.0.0.1` from the small deterministic high-port range
  `39201..39219`: it opens a localhost listener, connects a client to
  `127.0.0.1`, accepts the connection, receives the fixed monitor HTTP
  request, calls `__find_header_end` and `__parse_request`, verifies the
  parsed request (`method=GET`, `path=/tasks`, `version=HTTP/1.1`),
  invokes a monitor handler through `__call_handler` with the handler
  passed as a function pointer (`monitor_handler as i64`), verifies the
  handler-populated `VaisResponse` fields (`status=200`,
  `status_text=OK`, `version=HTTP/1.1`, `header_count=0`, `body_len=11`,
  `body={"ok":true}`), sends one fixed monitor HTTP response from the
  accepted server fd, receives it on the client fd (possibly across
  multiple recv calls), byte-verifies the exact response bytes through
  the built-in `load_byte`, calls `__parse_response`, verifies the parsed
  response status/version/status_text/body/headers, frees every
  parser-owned allocation for both the parsed request and the parsed
  response on every success and error path, and closes every opened fd
  on every success and error path. The fixture exercises only
  `__tcp_listen`, `__tcp_connect`, `__tcp_accept`, `__tcp_send`,
  `__tcp_recv`, `__tcp_close`, `__strlen`, `__find_header_end`,
  `__parse_request`, `__parse_response`, `__call_handler`, `__str_eq`,
  `__malloc`, and `__free` through their explicit C ABI (Vais string
  literals cross the boundary through `as i64` casts) and does not start
  a long-running server.
- Narrowed `scripts/check-runtime-boundary.sh` so the HTTP request-response
  loop symbol allowlist applies only to
  `server/src/http_request_response_loop.vais`; other HTTP runtime,
  `__tcp_*`, DB, and WS runtime symbols remain blocked across
  `server/src` and `playground`.
- Added `server/src/db_query_rows.vais` and
  `scripts/check-db-query-rows.sh` to certify the monitor-specific
  multi-row query + schema migration + column metadata slice. The fixture
  pins the database file to `/tmp/vais-monitor-db-query-rows.sqlite`,
  drops/creates `monitor_tasks`, inserts exactly three rows by reusing one
  prepared INSERT statement with `__sqlite_reset` (verifying
  `__sqlite_changes` is `1` after each insert and
  `__sqlite_last_insert_rowid` is `3` after the third insert), applies an
  `ALTER TABLE monitor_tasks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`
  migration through `__sqlite_exec`, runs a parameterized
  `UPDATE monitor_tasks SET archived = 1 WHERE priority >= ?` with bound
  threshold `8` and verifies `__sqlite_changes` is `2`, and walks a
  `SELECT id, priority, title_len, archived FROM monitor_tasks ORDER BY id`
  prepared statement. The fixture verifies `__sqlite_column_count` is `4`,
  compares the four `__sqlite_column_name` C strings byte-by-byte against
  `id`, `priority`, `title_len`, `archived` (including the trailing NUL)
  through the built-in `load_byte`, asserts `__sqlite_column_type` is
  `SQLITE_INTEGER` for every selected column on every row, asserts every
  selected integer cell exactly, and verifies that the fourth step returns
  `SQLITE_DONE`. The fixture exercises only `__sqlite_open`,
  `__sqlite_close`, `__sqlite_exec`, `__sqlite_prepare`,
  `__sqlite_bind_int`, `__sqlite_bind_text`, `__sqlite_step`,
  `__sqlite_column_int`, `__sqlite_column_type`, `__sqlite_column_count`,
  `__sqlite_column_name`, `__sqlite_finalize`, `__sqlite_reset`,
  `__sqlite_last_insert_rowid`, and `__sqlite_changes` through their
  explicit C ABI (Vais string literals cross the boundary through
  `as i64` casts). It does not use `__sqlite_column_text`, does not call
  `__str_eq` or `__free`, does not use callbacks, and does not start a
  server.
- Narrowed `scripts/check-runtime-boundary.sh` so the multi-row query
  + schema migration allowlist applies only to
  `server/src/db_query_rows.vais`; other `__sqlite_*`, HTTP runtime,
  `__tcp_*`, and WS runtime symbols remain blocked across `server/src`
  and `playground`.

## Next

1. Broaden DB persistence further (text column reads, transactions) only
   after a new monitor-specific fixture certifies the additional
   `__sqlite_*` surface required.
2. Replace the static TypeScript task state with data produced through the Vais
   adapter path.

## Completion Rule

Do not call this app complete until language/compiler, DB, server, web, docs,
and playground gates are all named and reproducible from a clean checkout.

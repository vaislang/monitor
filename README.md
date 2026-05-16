# monitor

[![Monitor Reference Gates](https://github.com/vaislang/monitor/actions/workflows/reference-gates.yml/badge.svg)](https://github.com/vaislang/monitor/actions/workflows/reference-gates.yml)

Current clean rewrite for a Vais reference app. The repository was intentionally
reset on 2026-05-15 so new code starts from the current public language and
compiler baseline.

## Why

The previous implementation reached 51 completed tasks across 9 phases but
final server linking failed because `vais-server` runtime symbols
(`server_listen*`, `db_*`, `ws_*`, ...) are not yet implemented. The legacy
tree also predated the current Vais language baseline (canonical `fn`/`struct`/
`enum`, Result/Option/match, generic enum layout with i32 tag, strict type
boundaries).

Rather than patch around missing runtime symbols, the project is being rebuilt
from a clean vertical slice using the current official Vais docs.

## Current slice

- `server/src/main.vais`: pure Vais domain core using `fn`, `struct`, `enum`,
  `Option<T>`, `Result<T, E>`, and `match`.
- `server/build.sh --ir-only`: emits LLVM IR to a temporary directory without
  linking server/db/ws runtime symbols.
- `server/build.sh --native`: builds and runs the pure Vais domain smoke.
- `server/src/http_adapter.vais`: monitor-specific HTTP listener lifecycle
  fixture. It certifies `__tcp_listen`/`__tcp_close` only.
- `server/src/http_request.vais`: monitor-specific HTTP request parsing/routing
  fixture. It certifies `__strlen`, `__find_header_end`, `__parse_request`,
  `__str_eq`, `__malloc`, and `__free` against fixed raw HTTP requests by
  calling the runtime parser through its explicit C ABI: a 64-byte
  `VaisRequest` output buffer is allocated, `__parse_request(out, raw_ptr,
  len)` populates it, and fields are read via the built-in `load_i64`. The
  fixture does not start a long-running server.
- `server/src/http_response.vais`: monitor-specific HTTP response loopback
  fixture. It certifies `__tcp_listen`, `__tcp_connect`, `__tcp_accept`,
  `__tcp_send`, `__tcp_recv`, `__tcp_close`, `__strlen`, `__malloc`, and
  `__free` by completing one deterministic in-process HTTP response
  roundtrip on `127.0.0.1`: it opens a localhost listener on a high port
  from the small deterministic range `39181..39199`, connects a client,
  accepts the connection, sends one fixed monitor HTTP response, receives it
  back (possibly across multiple recv calls), byte-verifies the bytes
  through the built-in `load_byte`, and closes every opened fd on every
  success and error path. The fixture does not start a long-running server.
- `playground/monitor.vais`: playground copy of the same domain source. Keep it
  synchronized with `scripts/sync-playground-example.sh`.
- `web/`: static Vite shell that displays the same seed monitor task state.
- `scripts/check-runtime-boundary.sh`: allows only the named per-fixture
  HTTP/DB runtime symbols and rejects uncertified DB/WS/server calls.
- `scripts/check-adapter-readiness.sh`: reports whether public DB/server/web
  runtime evidence has been promoted enough to start HTTP/DB adapter work.
- `scripts/check-http-adapter.sh`: emits IR, links the HTTP runtime fixture, and
  runs the listener lifecycle smoke.
- `scripts/check-http-request.sh`: emits IR, links the HTTP runtime fixture, and
  runs the request parsing/routing smoke against fixed raw HTTP requests.
- `scripts/check-http-response.sh`: emits IR, links the HTTP runtime fixture,
  and runs the response loopback smoke on `127.0.0.1` from a small
  deterministic high-port range.
- `server/src/http_response_parse.vais`: monitor-specific HTTP response
  parsing fixture. It certifies `__strlen`, `__parse_response`, `__str_eq`,
  `__malloc`, and `__free` against two fixed raw HTTP response strings
  (`200 OK` JSON and `404 Not Found`) by calling the runtime parser through
  its explicit C ABI: a 64-byte `VaisResponse` output buffer is allocated,
  `__parse_response(out, raw_ptr, len)` populates it, and fields are read
  via the built-in `load_i64`. The fixture asserts `status`, `version`,
  `status_text`, `body_len`, the exact body bytes, and the
  `Content-Type`/`Content-Length`/`Connection` header name/value pairs by
  walking the 16-bytes-per-entry `header_items` allocation. The body slice
  aliases the raw response buffer and is byte-copied into a fresh
  null-terminated buffer through `load_byte`/`store_byte` before equality
  comparison; only the C strings owned by the parsed response and the
  `header_items` allocation are released through `__free`. The fixture
  does not open any sockets and does not start a long-running server.
- `server/src/db_persistence.vais`: monitor-specific DB persistence fixture. It
  certifies `__sqlite_open`, `__sqlite_close`, `__sqlite_exec`,
  `__sqlite_prepare`, `__sqlite_bind_int`, `__sqlite_bind_text`,
  `__sqlite_step`, `__sqlite_column_int`, `__sqlite_finalize`,
  `__sqlite_last_insert_rowid`, and `__sqlite_changes` against the public
  SQLite runtime. The fixture opens a file database, creates `monitor_tasks`,
  inserts one row, closes the connection, reopens the file, and verifies the
  persisted row through `SELECT COUNT(*)/SUM(priority)/SUM(title_len)`.
  Path/SQL/text arguments cross the C boundary through explicit `as i64`
  casts.
- `scripts/check-http-response-parse.sh`: emits IR, links the HTTP runtime
  fixture, and runs the response parsing smoke against two fixed raw HTTP
  response strings.
- `server/src/http_request_response_loop.vais`: monitor-specific HTTP
  persistent request-response loop fixture. It certifies `__tcp_listen`,
  `__tcp_connect`, `__tcp_accept`, `__tcp_send`, `__tcp_recv`, `__tcp_close`,
  `__strlen`, `__find_header_end`, `__parse_request`, `__parse_response`,
  `__call_handler`, `__str_eq`, `__malloc`, and `__free` by completing one
  bounded in-process HTTP request-response cycle on `127.0.0.1` from the
  small deterministic high-port range `39201..39219`: it opens a localhost
  listener, connects a client, accepts the connection, receives the fixed
  monitor HTTP request, calls `__find_header_end` and `__parse_request`,
  verifies the parsed request, invokes a monitor handler through
  `__call_handler` with the handler passed as a function pointer
  (`monitor_handler as i64`), verifies the handler-populated
  `VaisResponse` fields, sends one fixed monitor HTTP response from the
  accepted server fd, receives it on the client fd, byte-verifies the
  bytes through the built-in `load_byte`, calls `__parse_response`,
  verifies the parsed response, frees every parser-owned allocation, and
  closes every opened fd on every success and error path. The fixture
  does not start a long-running server.
- `scripts/check-http-request-response-loop.sh`: emits IR, links the HTTP
  runtime fixture, and runs the request-response loop smoke on `127.0.0.1`
  from a small deterministic high-port range.
- `scripts/check-db-persistence.sh`: emits IR, links the SQLite runtime fixture
  (`std/sqlite_runtime.c` plus `-lsqlite3`), and runs the persistence smoke.
- `server/src/db_query_rows.vais`: monitor-specific DB multi-row query +
  schema migration + column metadata fixture. It certifies `__sqlite_open`,
  `__sqlite_close`, `__sqlite_exec`, `__sqlite_prepare`, `__sqlite_bind_int`,
  `__sqlite_bind_text`, `__sqlite_step`, `__sqlite_column_int`,
  `__sqlite_column_type`, `__sqlite_column_count`, `__sqlite_column_name`,
  `__sqlite_finalize`, `__sqlite_reset`, `__sqlite_last_insert_rowid`, and
  `__sqlite_changes` against the public SQLite runtime. The fixture pins the
  database file to `/tmp/vais-monitor-db-query-rows.sqlite`, drops/creates
  `monitor_tasks`, inserts exactly three rows by reusing one prepared
  INSERT statement with `__sqlite_reset` (verifying `__sqlite_changes`
  after each insert and `__sqlite_last_insert_rowid` after the third
  insert), applies `ALTER TABLE monitor_tasks ADD COLUMN archived
  INTEGER NOT NULL DEFAULT 0` through `__sqlite_exec`, runs a
  parameterized `UPDATE` with a bound integer threshold and verifies
  `__sqlite_changes` is `2`, then walks `SELECT id, priority,
  title_len, archived FROM monitor_tasks ORDER BY id`. It asserts the
  column count, the column names (byte-by-byte through the built-in
  `load_byte`, including the trailing NUL), `SQLITE_INTEGER` for every
  selected column type on every row, the exact integer cell values
  across three rows, and that the fourth step returns `SQLITE_DONE`.
  Multi-row reads are observed through integer columns only.
- `scripts/check-db-query-rows.sh`: emits IR, links the SQLite runtime
  fixture (`std/sqlite_runtime.c` plus `-lsqlite3`), and runs the
  multi-row query + schema migration + column metadata smoke.
- `server/src/db_transactions.vais`: monitor-specific DB SQLite
  transaction fixture. It certifies `__sqlite_open`, `__sqlite_close`,
  `__sqlite_exec`, `__sqlite_prepare`, `__sqlite_bind_int`,
  `__sqlite_bind_text`, `__sqlite_step`, `__sqlite_column_int`,
  `__sqlite_finalize`, `__sqlite_reset`, and `__sqlite_changes`
  against the public SQLite runtime. The fixture pins the database
  file to `/tmp/vais-monitor-db-transactions.sqlite`, drops/creates
  `monitor_events`, opens a `BEGIN IMMEDIATE` transaction, inserts one
  row through a prepared statement, verifies `__sqlite_changes` is `1`,
  rolls the transaction back through `ROLLBACK`, verifies that
  `SELECT COUNT(*)` is `0`, opens a second `BEGIN IMMEDIATE`
  transaction, inserts exactly two rows by reusing one prepared INSERT
  statement with `__sqlite_reset` (verifying `__sqlite_changes` is `1`
  after each insert), commits through `COMMIT`, verifies that
  `SELECT COUNT(*)` is `2` and `SELECT SUM(priority)` is `11`, closes
  the handle, reopens the same file, and confirms that COUNT(*) is
  still `2` and SUM(priority) is still `11` across close/reopen.
  Path/SQL/text arguments cross the C boundary through explicit
  `as i64` casts. Transaction observation is integer-column only.
- `scripts/check-db-transactions.sh`: emits IR, links the SQLite
  runtime fixture (`std/sqlite_runtime.c` plus `-lsqlite3`), and runs
  the transaction (rollback + commit + close/reopen persistence)
  smoke.
- `.github/workflows/reference-gates.yml`: GitHub Actions workflow template for
  hosted gate execution.

## Verify

```bash
scripts/check-reference-gates.sh
```

After committing a change, verify the committed tree:

```bash
scripts/check-clean-checkout.sh
```

## Recover the previous tree

```bash
git checkout legacy-before-rewrite-2026-05-15
```

The tag points at commit `d78e67f` ("docs: prepare monitor reference rewrite
handoff"). Full history including PRD.md, ROADMAP.md, and the legacy
server/web sources is preserved in git history.

## Required reading before new code

Read in this order before writing any Vais:

1. `/Users/sswoo/study/projects/vais/compiler/docs/ai/LLM_LANGUAGE_CARD.md`
2. `/Users/sswoo/study/projects/vais/compiler/docs/LANGUAGE_SPEC.md`
3. `/Users/sswoo/study/projects/vais/compiler/PUBLIC_STATUS.md`
4. `/Users/sswoo/study/projects/vais/compiler/docs/ai/AI_DEVELOPER_GUIDE.md`
5. `/Users/sswoo/study/projects/vais/compiler/docs/ai/REFERENCE_APP_CONTRACT.md`
6. `docs/GOAL.md`
7. `docs/RUNTIME_BOUNDARY.md`
8. `docs/ADAPTER_READINESS.md`
9. `docs/CI.md`

## Next

Per `REFERENCE_APP_CONTRACT.md`, broaden only after the current named gates pass.
`scripts/check-adapter-readiness.sh --require-promoted` passes against the
current compiler baseline. Eight monitor-specific fixtures are now certified:
HTTP listener open/close, HTTP request parsing/routing on fixed raw HTTP
strings, one deterministic in-process HTTP response loopback on
`127.0.0.1`, HTTP response parsing on fixed raw HTTP response strings, one
bounded in-process HTTP request-response cycle that wires `__parse_request`,
`__call_handler`, and `__parse_response` together on `127.0.0.1`, DB
persistence across close/reopen on a fixed SQLite file database, one
bounded multi-row SQLite query + schema migration + column metadata slice
on a fixed SQLite file database, and one bounded SQLite transaction slice
that certifies rollback, commit, and close/reopen persistence on a fixed
SQLite file database. The next implementation slice broadens DB
persistence further (text column reads) only after a new monitor-specific
fixture certifies the additional `__sqlite_*` surface required; broaden
only after each new slice is reproducible from a clean checkout.

Do not reintroduce legacy `F`/`S`/`EN`/`EL`/`R`/`U` syntax, do not commit
`.ll` / `.db` / `node_modules` / `dist`, and do not claim completion beyond
named gates.

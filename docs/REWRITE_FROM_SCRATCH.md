# Rewrite From Scratch

The previous monitor implementation was removed from the working tree because it
depended on runtime symbols that are not yet certified for this reference app:
`server_listen*`, `db_*`, and `ws_*`.

The rewrite starts with the smallest evidence-backed slice:

- Vais domain logic compiles to LLVM IR only.
- Generic enums use the public `Option<T>` and `Result<T, E>` surface.
- The IR layout fixture rejects anonymous `{ i8, i64 }` enum layout regressions.
- The playground sample is synchronized from the same domain source.
- The web shell builds separately and does not claim server integration.
- Docs name evidence boundaries instead of product-complete status.
- `scripts/check-clean-checkout.sh` verifies committed changes from a temporary
  git worktree.
- `scripts/check-runtime-boundary.sh` prevents uncertified HTTP/DB/WS runtime
  calls from returning unnoticed.
- `scripts/check-http-adapter.sh` certifies only HTTP listener open/close
  wiring.
- `scripts/check-http-request.sh` certifies only HTTP request parsing/routing
  for fixed raw HTTP strings (no long-running server). The fixture uses the
  runtime parser's explicit C ABI: a 64-byte `VaisRequest` output buffer is
  allocated through `__malloc`, the parser writes through an out-pointer, and
  fields are read via the built-in `load_i64`.
- `scripts/check-http-response.sh` certifies only one deterministic
  in-process HTTP response roundtrip on `127.0.0.1` (no long-running server).
  The fixture opens a localhost listener on a high port from the small
  deterministic range `39181..39199`, connects a client, accepts the
  connection, sends one fixed monitor HTTP response, receives it back
  (possibly across multiple recv calls), byte-verifies the bytes through the
  built-in `load_byte`, and closes every opened fd on every success and
  error path.
- `scripts/check-http-response-parse.sh` certifies only HTTP response parsing
  on fixed raw HTTP response strings (no long-running server, no sockets).
  The fixture allocates a 64-byte `VaisResponse` output buffer, calls
  `__parse_response(out, raw_ptr, len)`, reads the C out-pointer through the
  built-in `load_i64`, asserts the status code, version (`HTTP/1.1`), status
  text, body length, and exact body bytes for a `200 OK` JSON response and a
  `404 Not Found` response, and walks the `header_items` allocation (16
  bytes per entry) to confirm `Content-Type`, `Content-Length`, and
  `Connection` header name/value pairs. The body slice aliases the raw
  response buffer and is byte-copied into a fresh null-terminated buffer
  through `load_byte`/`store_byte` before equality comparison.
- `scripts/check-http-request-response-loop.sh` certifies only one bounded
  in-process HTTP request-response cycle on `127.0.0.1` (no long-running
  server). The fixture opens a localhost listener on a high port from the
  small deterministic range `39201..39219`, connects a client, accepts
  the connection, receives the fixed monitor HTTP request, calls
  `__find_header_end` and `__parse_request`, verifies the parsed request,
  invokes a monitor handler through `__call_handler` with the handler
  passed as a function pointer (`monitor_handler as i64`), verifies the
  handler-populated `VaisResponse` fields, sends one fixed monitor HTTP
  response, receives it back (possibly across multiple recv calls),
  byte-verifies the bytes through the built-in `load_byte`, calls
  `__parse_response`, verifies the parsed response, frees every
  parser-owned allocation, and closes every opened fd on every success
  and error path.
- `scripts/check-db-persistence.sh` certifies only DB persistence against a
  fixed file SQLite database. The fixture opens the database, creates a
  `monitor_tasks` table, inserts one row, closes the connection, reopens the
  file, and verifies the persisted row through a `SELECT
  COUNT(*)/SUM(priority)/SUM(title_len)` query. Persistence is observed
  through integer columns only — text columns are not part of the allowlist.
  Path/SQL/text arguments cross the C boundary through explicit `as i64`
  casts.
- `scripts/check-db-query-rows.sh` certifies only one bounded multi-row
  SQLite query + schema migration + column metadata slice against a
  fixed file SQLite database. The fixture opens the database, drops and
  creates `monitor_tasks`, inserts exactly three rows by reusing one
  prepared `INSERT` statement with `__sqlite_reset` between executions
  (verifying `__sqlite_changes` and `__sqlite_last_insert_rowid` along
  the way), applies one `ALTER TABLE` migration through
  `__sqlite_exec`, runs a parameterized `UPDATE` with a bound integer
  threshold and verifies `__sqlite_changes` is `2`, then walks a
  prepared `SELECT id, priority, title_len, archived FROM
  monitor_tasks ORDER BY id` statement. It asserts
  `__sqlite_column_count` is `4`, compares the four
  `__sqlite_column_name` C strings byte-by-byte against the expected
  literals through the built-in `load_byte` (including the trailing
  NUL), asserts `__sqlite_column_type` is `SQLITE_INTEGER` for every
  selected column on every row, asserts every selected integer cell,
  and verifies that the fourth step returns `SQLITE_DONE`. Multi-row
  reads are observed through integer columns only — text columns are
  not part of the allowlist, the fixture does not call `__str_eq` or
  `__free`, and the check script links only the SQLite runtime
  translation unit. Path/SQL/text arguments cross the C boundary
  through explicit `as i64` casts.
- `scripts/check-db-transactions.sh` certifies only one bounded
  SQLite transaction slice against a fixed file SQLite database.
  The fixture opens the database, drops and creates `monitor_events`,
  opens a `BEGIN IMMEDIATE` transaction, inserts one row through a
  prepared statement (`title="rolled back"`, `priority=99`),
  verifies `__sqlite_changes` is `1`, rolls back through `ROLLBACK`,
  verifies that `SELECT COUNT(*)` is `0`, opens a second
  `BEGIN IMMEDIATE` transaction, inserts exactly two rows by reusing
  one prepared INSERT statement with `__sqlite_reset`
  (`title="committed low"`, `priority=4` and
  `title="committed high"`, `priority=7`, verifying
  `__sqlite_changes` is `1` after each insert), commits through
  `COMMIT`, verifies that `SELECT COUNT(*)` is `2` and
  `SELECT SUM(priority)` is `11`, closes the handle, reopens the
  same file, and confirms that COUNT(*) is still `2` and
  SUM(priority) is still `11` across close/reopen. Every prepared
  statement is finalized and every handle is closed on every
  success and error path; on every error path inside an open
  transaction the fixture best-effort `ROLLBACK`s before returning.
  Transaction observation is integer-column only — the fixture does
  not call `__sqlite_column_text`, does not call `__str_eq` or
  `__free`, and the check script links only the SQLite runtime
  translation unit. Path/SQL/text arguments cross the C boundary
  through explicit `as i64` casts.
- Broader runtime behavior remains out of scope until named fixtures exist.

Recover the old tree only for comparison:

```bash
git checkout legacy-before-rewrite-2026-05-15
```

Do not copy old source back into `master` without revalidating it against the
current language card and public status document.

# Goal Contract

Goal: make `monitor` a reproducible Vais reference app that another AI can build
from the official Vais docs without relying on hidden project memory.

## Certified Current Scope

- Language/compiler slice: `server/src/main.vais`
- Native domain smoke: `server/build.sh --native`
- Playground sample: `playground/monitor.vais`, synchronized from the server
  source
- Web shell: `web/`
- Root gate: `scripts/check-reference-gates.sh`
- Clean-checkout gate: `scripts/check-clean-checkout.sh` after changes are
  committed
- Runtime boundary gate: `scripts/check-runtime-boundary.sh`
- Adapter readiness gate: `scripts/check-adapter-readiness.sh`
- HTTP listener lifecycle gate: `scripts/check-http-adapter.sh`
- HTTP request parsing/routing gate: `scripts/check-http-request.sh`
- HTTP response loopback gate: `scripts/check-http-response.sh`
- HTTP response parsing gate: `scripts/check-http-response-parse.sh`
- HTTP persistent request-response loop gate:
  `scripts/check-http-request-response-loop.sh`
- DB persistence gate: `scripts/check-db-persistence.sh`
- DB multi-row query + schema migration + column metadata gate:
  `scripts/check-db-query-rows.sh`
- DB transactions gate: `scripts/check-db-transactions.sh`
- CI template: `.github/workflows/reference-gates.yml`
- Remote: `https://github.com/vaislang/monitor`

## Acceptance Rule

No new surface is considered done until it has:

1. A named source file or fixture.
2. A deterministic local verification command.
3. Documentation that states both the certified behavior and the boundary.
4. A clean-checkout verification path.
5. Hosted CI evidence when a remote workflow surface exists.

## Runtime Adapter Surfaces

HTTP and DB adapter work is allowed only after the corresponding server/db
runtime symbols have reproducible named gates for this app shape. The
precondition is:

```bash
scripts/check-adapter-readiness.sh --require-promoted
```

Do not add placeholder runtime calls that only fail at link time. Add a
monitor-specific runtime fixture and narrow `scripts/check-runtime-boundary.sh`
before claiming adapter completion.

Current HTTP adapter certification is limited to five narrow fixtures:

- Listener open/close through `__tcp_listen` and `__tcp_close` in
  `server/src/http_adapter.vais`.
- Request parsing/routing through `__strlen`, `__find_header_end`,
  `__parse_request`, `__str_eq`, `__malloc`, and `__free` in
  `server/src/http_request.vais`. The fixture uses the runtime parser's
  explicit C ABI: a 64-byte output buffer is allocated, the parser writes
  through an out-pointer, and fields are read via the built-in `load_i64`.
- One deterministic in-process HTTP response loopback through `__tcp_listen`,
  `__tcp_connect`, `__tcp_accept`, `__tcp_send`, `__tcp_recv`, `__tcp_close`,
  `__strlen`, `__malloc`, and `__free` in `server/src/http_response.vais`.
  The fixture opens a localhost listener on a high port from a small
  deterministic range, connects a client to `127.0.0.1`, accepts the
  connection, sends one fixed monitor HTTP response from the accepted server
  fd, receives it on the client fd (possibly across multiple recv calls),
  byte-verifies the exact response bytes through the built-in `load_byte`,
  and closes every opened fd on every success and error path.
- Response parsing through `__strlen`, `__parse_response`, `__str_eq`,
  `__malloc`, and `__free` in `server/src/http_response_parse.vais`. The
  fixture parses two fixed raw HTTP response strings (`200 OK` JSON and
  `404 Not Found`) through `__parse_response`, reads the 64-byte
  `VaisResponse` C out-pointer through `load_i64`, asserts `status`,
  `version`, `status_text`, `body_len`, the exact body bytes, and the
  `Content-Type`/`Content-Length`/`Connection` header name/value pairs.
- One bounded in-process HTTP request-response cycle through `__tcp_listen`,
  `__tcp_connect`, `__tcp_accept`, `__tcp_send`, `__tcp_recv`, `__tcp_close`,
  `__strlen`, `__find_header_end`, `__parse_request`, `__parse_response`,
  `__call_handler`, `__str_eq`, `__malloc`, and `__free` in
  `server/src/http_request_response_loop.vais`. The fixture opens a
  localhost listener on a high port from the small deterministic range
  `39201..39219`, connects a client to `127.0.0.1`, accepts the
  connection, receives the fixed monitor HTTP request, calls
  `__find_header_end` and `__parse_request`, verifies the parsed request,
  invokes a monitor handler through `__call_handler` with the handler
  passed as a function pointer (`monitor_handler as i64`), verifies the
  handler-populated `VaisResponse` fields, sends one fixed monitor HTTP
  response from the accepted server fd, receives it on the client fd,
  byte-verifies the bytes through the built-in `load_byte`, calls
  `__parse_response`, verifies the parsed response, frees every
  parser-owned allocation, and closes every opened fd on every success
  and error path.

Current DB adapter certification is limited to three narrow fixtures:

- Persistence (open / drop / create / insert / close / reopen / select /
  close) through `__sqlite_open`, `__sqlite_close`, `__sqlite_exec`,
  `__sqlite_prepare`, `__sqlite_bind_int`, `__sqlite_bind_text`,
  `__sqlite_step`, `__sqlite_column_int`, `__sqlite_finalize`,
  `__sqlite_last_insert_rowid`, and `__sqlite_changes` in
  `server/src/db_persistence.vais`. Persistence is observed through integer
  columns only.
- Multi-row query + schema migration + column metadata (open / drop /
  create / three inserts via one prepared statement reused with
  `__sqlite_reset` / `ALTER TABLE` migration / parameterized `UPDATE`
  whose `__sqlite_changes` is verified / `SELECT` with
  `__sqlite_column_count`, `__sqlite_column_name` byte-by-byte through
  `load_byte`, `__sqlite_column_type` `SQLITE_INTEGER`, and exact
  integer cell values across three rows + `SQLITE_DONE` / close) through
  `__sqlite_open`, `__sqlite_close`, `__sqlite_exec`, `__sqlite_prepare`,
  `__sqlite_bind_int`, `__sqlite_bind_text`, `__sqlite_step`,
  `__sqlite_column_int`, `__sqlite_column_type`, `__sqlite_column_count`,
  `__sqlite_column_name`, `__sqlite_finalize`, `__sqlite_reset`,
  `__sqlite_last_insert_rowid`, and `__sqlite_changes` in
  `server/src/db_query_rows.vais`. Multi-row reads are observed through
  integer columns only; `__sqlite_column_text` is not part of the
  allowlist.
- Transactions (open / drop / create / `BEGIN IMMEDIATE` / insert one
  row / verify `__sqlite_changes` / `ROLLBACK` / verify
  `SELECT COUNT(*)` is `0` / `BEGIN IMMEDIATE` / two inserts via one
  prepared statement reused with `__sqlite_reset` / `COMMIT` / verify
  `SELECT COUNT(*)` is `2` and `SELECT SUM(priority)` is `11` /
  close / reopen / verify counts still match / close) through
  `__sqlite_open`, `__sqlite_close`, `__sqlite_exec`,
  `__sqlite_prepare`, `__sqlite_bind_int`, `__sqlite_bind_text`,
  `__sqlite_step`, `__sqlite_column_int`, `__sqlite_finalize`,
  `__sqlite_reset`, and `__sqlite_changes` in
  `server/src/db_transactions.vais`. Transaction observation is
  integer-column only.

This is not a long-running server, multi-row text reads, query helpers
beyond the certified column-metadata and transaction surfaces, URL
parsing, or production server completion.

# Runtime Boundary

The current monitor reference app intentionally stops at a pure server-domain
slice, two narrow HTTP runtime fixtures, and a static web shell. The domain
slice has both IR and native smoke gates.

## Allowed Now

- Pure Vais domain code in `server/src/main.vais`
- Generic enum layout verification through `scripts/check-ir-layout.sh`
- Native domain execution through `server/build.sh --native`
- HTTP listener lifecycle through `server/src/http_adapter.vais`
  and `scripts/check-http-adapter.sh`
- HTTP request parsing/routing through `server/src/http_request.vais`
  and `scripts/check-http-request.sh`
- HTTP response loopback (listen / connect / accept / send / recv /
  byte-verify / close) through `server/src/http_response.vais` and
  `scripts/check-http-response.sh`
- HTTP response parsing through `server/src/http_response_parse.vais` and
  `scripts/check-http-response-parse.sh`
- DB persistence (open / drop / create / insert / close / reopen / select /
  close) through `server/src/db_persistence.vais` and
  `scripts/check-db-persistence.sh`
- Playground source synchronization through `playground/monitor.vais`
- Static web build through `web/`

## Exact Runtime Allowlist

Each fixture has its own narrow runtime allowlist. The list is enforced by
`scripts/check-runtime-boundary.sh` and no other reference app source may call
these symbols.

`server/src/http_adapter.vais` may call only:

- `__tcp_listen`
- `__tcp_close`

These certify that the monitor app can link the public HTTP runtime and open
then close a listener. They do not certify request parsing, request routing,
response writing, DB persistence, WebSocket handling, or a long-running server.

`server/src/http_request.vais` may call only:

- `__strlen`
- `__find_header_end`
- `__parse_request`
- `__str_eq`
- `__malloc`
- `__free`

These certify that the monitor app can parse a fixed raw HTTP request through
the public HTTP runtime and route it to monitor-specific route codes. The
fixture exercises `GET /health`, `GET /tasks`, `GET /missing`, `POST /health`,
and a request with a body. It does not certify response writing, DB
persistence, WebSocket handling, accepting client connections, or a
long-running server.

The fixture uses the explicit C ABI for the runtime parser: it allocates a
64-byte `VaisRequest` output buffer through `__malloc`, calls
`__parse_request(out, raw_ptr, len)`, reads each field with the built-in
`load_i64`, and frees the allocation through `__free`. Runtime symbols are
declared with raw `i64` pointer arguments and Vais string literals are passed
to `__str_eq` through an explicit `as i64` boundary. This avoids passing Vais
fat strings into a C function that expects two pointer arguments.

`server/src/http_response.vais` may call only:

- `__tcp_listen`
- `__tcp_connect`
- `__tcp_accept`
- `__tcp_send`
- `__tcp_recv`
- `__tcp_close`
- `__strlen`
- `__malloc`
- `__free`

These certify that the monitor app can complete one deterministic in-process
HTTP response roundtrip on `127.0.0.1`: open a localhost listener on a high
port from the small deterministic range `39181..39199`, connect a client to
`127.0.0.1`, accept the connection, send one fixed monitor HTTP response from
the accepted server fd, receive it on the client fd (possibly across multiple
recv calls), byte-verify the exact response bytes through the built-in
`load_byte`, and close every opened fd on every success and error path. The
fixture does not start a long-running server, does not parse the response, and
does not write or read any DB state. The received buffer is never compared
through `__str_eq` because it is not null-terminated; comparison runs byte by
byte against the expected response literal.

The exact monitor response bytes verified by the fixture are:

```
HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 11\r\nConnection: close\r\n\r\n{"ok":true}
```

`server/src/http_response_parse.vais` may call only:

- `__strlen`
- `__parse_response`
- `__str_eq`
- `__malloc`
- `__free`

These certify that the monitor app can parse a fixed raw HTTP response through
the public HTTP runtime and observe the resulting `VaisResponse` struct fields.
The fixture parses two responses:

```
HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 11\r\nConnection: close\r\n\r\n{"ok":true}
HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\n\r\nnot-found
```

For each response it asserts `status`, `version` (`HTTP/1.1`), `status_text`,
`body_len`, and the exact body bytes, plus header `name`/`value` pairs walked
through the 16-bytes-per-entry `header_items` array. The fixture exercises the
explicit C ABI for `__parse_response`: it allocates a 64-byte `VaisResponse`
output buffer through `__malloc`, calls
`__parse_response(out, raw_ptr, len)`, reads each scalar field through the
built-in `load_i64`, frees the C strings owned by the parsed response
(`version`, `status_text`, every header name and value) and the
`header_items` allocation through `__free`, and frees the output buffer.
The `body` pointer aliases into the raw response buffer and is therefore
never freed; the body bytes are copied into a fresh null-terminated buffer
through `load_byte`/`store_byte` before equality comparison so `__str_eq`
never reads past the end of the parsed slice.

`server/src/db_persistence.vais` may call only:

- `__sqlite_open`
- `__sqlite_close`
- `__sqlite_exec`
- `__sqlite_prepare`
- `__sqlite_bind_int`
- `__sqlite_bind_text`
- `__sqlite_step`
- `__sqlite_column_int`
- `__sqlite_finalize`
- `__sqlite_last_insert_rowid`
- `__sqlite_changes`

These certify that the monitor app can open a SQLite file database, create the
`monitor_tasks` table, insert one row, close the connection, reopen the
underlying file, and observe the persisted row through a numeric `SELECT`
query. The fixture uses `SQLITE_OK=0`, `SQLITE_ROW=100`, and `SQLITE_DONE=101`.
It pins the database file to `/tmp/vais-monitor-db-persistence.sqlite` and the
script removes that file plus its `-wal`/`-shm` siblings before and after each
run. The fixture does not certify multi-row reads through
`__sqlite_column_text` (it persists `title_len` as an integer column instead),
schema migration, transactions, query helpers, or any other `__sqlite_*`
symbol. Runtime symbols are declared with raw `i64` pointer arguments and Vais
string literals cross the C boundary through explicit `as i64` casts so the
runtime never receives a Vais fat string in a pointer slot.

## Still Blocked

Do not call these runtime families from the reference app source until this
repository adds another narrowed fixture for the exact symbols being used:

- `server_listen*`
- other `__tcp_*` symbols beyond the per-fixture allowlists (only
  `__tcp_listen`/`__tcp_close` are certified in `http_adapter.vais`, and only
  `__tcp_listen`/`__tcp_connect`/`__tcp_accept`/`__tcp_send`/`__tcp_recv`/
  `__tcp_close` are certified in `http_response.vais`)
- other HTTP runtime symbols (only `__strlen`, `__find_header_end`,
  `__parse_request`, `__str_eq`, `__malloc`, and `__free` are certified in
  `http_request.vais`; only `__strlen`, `__malloc`, and `__free` are
  certified in `http_response.vais`; only `__strlen`, `__parse_response`,
  `__str_eq`, `__malloc`, and `__free` are certified in
  `http_response_parse.vais`)
- other `__sqlite_*` symbols (only `__sqlite_open`, `__sqlite_close`,
  `__sqlite_exec`, `__sqlite_prepare`, `__sqlite_bind_int`,
  `__sqlite_bind_text`, `__sqlite_step`, `__sqlite_column_int`,
  `__sqlite_finalize`, `__sqlite_last_insert_rowid`, and `__sqlite_changes`
  are certified)
- `db_*`
- `ws_*`

`scripts/check-runtime-boundary.sh` enforces this over `server/src` and
`playground`.

Before changing this boundary, run:

```bash
scripts/check-adapter-readiness.sh --require-promoted
```

If it fails, the boundary remains closed. If it passes, add the smallest
monitor-specific fixture first and then narrow this boundary to the exact
certified symbols.

## Evidence Boundary

`/Users/sswoo/study/projects/vais/compiler/PUBLIC_STATUS.md` now provides the
upstream promotion marker needed to start adapter work. This app still must not
claim HTTP or DB integration completeness until monitor-specific runtime
fixtures pass from a clean checkout. See `docs/ADAPTER_READINESS.md` for the
promotion rule.

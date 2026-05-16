# Adapter Readiness

The monitor app does not add HTTP or DB adapters by inference from partial
runtime evidence. Adapter work starts only after a named public gate promotes the
single DB/server/web runtime path needed by this app shape.

## Current Decision

Status: promoted precondition available.

Current public evidence from the sibling Vais checkout:

- VaisDB runtime smoke: `34/34`
- Vais Server runtime smoke: `20/20`
- DB/server/web runtime main gate: promoted by compiler PR #53

This means HTTP/DB adapter work may now start, but it does not make monitor
complete by itself. Four monitor-specific HTTP adapter fixtures and one
monitor-specific DB persistence fixture are now allowed, each with its own
narrowed symbol set:

- `server/src/http_adapter.vais` allows only `__tcp_listen`/`__tcp_close`.
- `server/src/http_request.vais` allows only `__strlen`,
  `__find_header_end`, `__parse_request`, `__str_eq`, `__malloc`, and
  `__free`. The runtime parser is invoked through its explicit C ABI: a
  64-byte `VaisRequest` output buffer is allocated through `__malloc`, the
  parser fills it through an out-pointer, fields are read via the built-in
  `load_i64`, and the buffer is released through `__free`. Vais string
  literals cross the C boundary through explicit `as i64` casts.
- `server/src/http_response.vais` allows only `__tcp_listen`,
  `__tcp_connect`, `__tcp_accept`, `__tcp_send`, `__tcp_recv`, `__tcp_close`,
  `__strlen`, `__malloc`, and `__free`. The fixture completes one
  deterministic in-process HTTP response roundtrip on `127.0.0.1` from the
  small deterministic port range `39181..39199`: it opens a localhost
  listener, connects a client to `127.0.0.1`, accepts the connection, sends
  one fixed monitor HTTP response from the accepted server fd, receives it on
  the client fd (possibly across multiple recv calls), byte-verifies the
  exact response bytes through the built-in `load_byte`, and closes every
  opened fd on every success and error path. Runtime symbols are declared
  with raw `i64` pointer arguments and Vais string literals cross the C
  boundary through explicit `as i64` casts.
- `server/src/http_response_parse.vais` allows only `__strlen`,
  `__parse_response`, `__str_eq`, `__malloc`, and `__free`. The fixture
  parses two fixed raw HTTP response strings through `__parse_response`,
  reads the `VaisResponse` C out-pointer through the built-in `load_i64`,
  asserts `status`, `version` (`HTTP/1.1`), `status_text`, `body_len`, and
  the exact body bytes for a `200 OK` JSON response and a `404 Not Found`
  response, and walks the `header_items` allocation (16 bytes per entry) to
  confirm `Content-Type`, `Content-Length`, and `Connection` header
  name/value pairs. The body slice aliases the raw response buffer and is
  byte-copied into a fresh null-terminated buffer through
  `load_byte`/`store_byte` before equality comparison; only the C strings
  owned by the parsed response (`version`, `status_text`, every header name
  and value) and the `header_items` allocation are released through
  `__free`. Vais string literals cross the C boundary through explicit
  `as i64` casts.
- `server/src/db_persistence.vais` allows only `__sqlite_open`,
  `__sqlite_close`, `__sqlite_exec`, `__sqlite_prepare`, `__sqlite_bind_int`,
  `__sqlite_bind_text`, `__sqlite_step`, `__sqlite_column_int`,
  `__sqlite_finalize`, `__sqlite_last_insert_rowid`, and `__sqlite_changes`.
  The fixture opens a file database, creates `monitor_tasks`, inserts one
  row, closes the connection, reopens the file, and verifies the persisted
  row through `SELECT COUNT(*)/SUM(priority)/SUM(title_len)`. Path/SQL/text
  arguments are passed through the explicit C ABI (`char*` declared as `i64`,
  Vais string literals cast with `as i64`). Persistence is observed through
  integer columns only — `__sqlite_column_text` is not part of the allowlist.

## Gate

Use the status check during normal verification:

```bash
scripts/check-adapter-readiness.sh
```

Before implementing HTTP or DB adapters, require promotion explicitly:

```bash
scripts/check-adapter-readiness.sh --require-promoted
```

`--require-promoted` must pass before adding new calls such as `server_listen*`,
other `__tcp_*`, `db_*`, or `ws_*` to `server/src` or `playground`.

## Promotion Rule

An adapter task may begin only when all of these are true:

1. `compiler/PUBLIC_STATUS.md` names a promoted single DB/server/web runtime
   main gate.
2. `scripts/check-adapter-readiness.sh --require-promoted` passes from a clean
   checkout.
3. `docs/RUNTIME_BOUNDARY.md` is updated from "blocked" to the newly certified
   app shape.
4. `scripts/check-runtime-boundary.sh` is narrowed to allow only the newly
   certified symbols, not the entire runtime family.
5. A monitor-specific runtime fixture is added before any completion claim.

The current fixtures satisfy this rule only for the narrow symbol sets named
above. Broader HTTP runtime symbols (persistent server loops,
request-response handlers, URL parsing, additional response parser fields),
broader `__sqlite_*` symbols (query helpers, text columns, transactions,
schema migration), or WebSocket symbols each need a new fixture and a
matching boundary update before they may enter `server/src` or
`playground`.

If the upstream wording changes but the intended certification is equivalent,
update this script and document the exact public gate name in the same commit.

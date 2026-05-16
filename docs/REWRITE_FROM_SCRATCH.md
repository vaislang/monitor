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
- `scripts/check-db-persistence.sh` certifies only DB persistence against a
  fixed file SQLite database. The fixture opens the database, creates a
  `monitor_tasks` table, inserts one row, closes the connection, reopens the
  file, and verifies the persisted row through a `SELECT
  COUNT(*)/SUM(priority)/SUM(title_len)` query. Persistence is observed
  through integer columns only — text columns are not part of the allowlist.
  Path/SQL/text arguments cross the C boundary through explicit `as i64`
  casts.
- Broader runtime behavior remains out of scope until named fixtures exist.

Recover the old tree only for comparison:

```bash
git checkout legacy-before-rewrite-2026-05-15
```

Do not copy old source back into `master` without revalidating it against the
current language card and public status document.

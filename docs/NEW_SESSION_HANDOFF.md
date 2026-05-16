# New Session Handoff

Start here:

```bash
cd /Users/sswoo/study/projects/vais-apps/monitor
git status --short --branch
scripts/check-reference-gates.sh
```

After committing changes, run:

```bash
scripts/check-clean-checkout.sh
```

After pushing changes, verify the hosted workflow:

```bash
gh run list --repo vaislang/monitor --limit 5
```

The main server slice is intentionally domain-only. It validates current Vais
language surface through IR and native smoke gates. Five separate fixtures
certify narrow HTTP and DB runtime slices:

- `server/src/http_adapter.vais` certifies only HTTP listener open/close
  runtime wiring (`__tcp_listen`, `__tcp_close`).
- `server/src/http_request.vais` certifies only request parsing/routing on
  fixed raw HTTP strings (`__strlen`, `__find_header_end`, `__parse_request`,
  `__str_eq`, `__malloc`, `__free`). The runtime parser is called through its
  explicit C ABI: a 64-byte `VaisRequest` output buffer is allocated, the
  parser writes through an out-pointer, fields are read with the built-in
  `load_i64`, and string literals cross the C boundary through explicit
  `as i64` casts.
- `server/src/http_response.vais` certifies only one deterministic
  in-process HTTP response roundtrip on `127.0.0.1` (`__tcp_listen`,
  `__tcp_connect`, `__tcp_accept`, `__tcp_send`, `__tcp_recv`, `__tcp_close`,
  `__strlen`, `__malloc`, `__free`). The fixture opens a listener on a high
  port from the small deterministic range `39181..39199`, connects a client,
  accepts the connection, sends one fixed monitor HTTP response, receives it
  back (possibly across multiple recv calls), byte-verifies the bytes through
  the built-in `load_byte`, and closes every opened fd on every success and
  error path. It does not start a long-running server.
- `server/src/http_response_parse.vais` certifies only HTTP response parsing
  on fixed raw HTTP response strings (`__strlen`, `__parse_response`,
  `__str_eq`, `__malloc`, `__free`). The fixture allocates a 64-byte
  `VaisResponse` output buffer, calls `__parse_response(out, raw_ptr, len)`,
  reads the C out-pointer through the built-in `load_i64`, asserts
  `status`, `version`, `status_text`, `body_len`, the exact body bytes for
  a `200 OK` JSON response and a `404 Not Found` response, and walks the
  `header_items` allocation (16 bytes per entry) to confirm
  `Content-Type`, `Content-Length`, and `Connection` header name/value
  pairs. The body slice aliases the raw response buffer and is byte-copied
  into a fresh null-terminated buffer through `load_byte`/`store_byte`
  before equality comparison; the buffer, every parsed C string, and the
  `header_items` allocation are released on every success and error path.
  Vais string literals cross the C boundary through explicit `as i64`
  casts.
- `server/src/db_persistence.vais` certifies only DB persistence on a fixed
  file database (`__sqlite_open`, `__sqlite_close`, `__sqlite_exec`,
  `__sqlite_prepare`, `__sqlite_bind_int`, `__sqlite_bind_text`,
  `__sqlite_step`, `__sqlite_column_int`, `__sqlite_finalize`,
  `__sqlite_last_insert_rowid`, `__sqlite_changes`). The fixture opens the
  database, creates `monitor_tasks`, inserts one row, closes the connection,
  reopens the file, and verifies the persisted row through `SELECT
  COUNT(*)/SUM(priority)/SUM(title_len)`. Path/SQL/text arguments cross the
  C boundary through explicit `as i64` casts.

`playground/monitor.vais` is a synchronized copy of `server/src/main.vais`. If
the server source changes, run `scripts/sync-playground-example.sh` before the
reference gates.

The current source of truth for language and public claims is the sibling
compiler repository:

- `/Users/sswoo/study/projects/vais/compiler/docs/ai/LLM_LANGUAGE_CARD.md`
- `/Users/sswoo/study/projects/vais/compiler/docs/LANGUAGE_SPEC.md`
- `/Users/sswoo/study/projects/vais/compiler/PUBLIC_STATUS.md`
- `docs/GOAL.md`
- `docs/RUNTIME_BOUNDARY.md`
- `docs/ADAPTER_READINESS.md`
- `docs/CI.md`

If compiler behavior and docs disagree, stop and fix the compiler or docs before
adding fallback syntax here.

Before adding HTTP or DB runtime code, run:

```bash
scripts/check-adapter-readiness.sh --require-promoted
```

At the current baseline this is expected to pass. Passing this precondition only
opens adapter work; it does not replace the need for a monitor-specific runtime
fixture and a narrowed runtime-boundary gate.

The HTTP listener fixture allows only `__tcp_listen` and `__tcp_close`. The
HTTP request fixture allows only `__strlen`, `__find_header_end`,
`__parse_request`, `__str_eq`, `__malloc`, and `__free`, and uses the runtime
parser through its explicit C output-buffer ABI. The HTTP response fixture
allows only `__tcp_listen`, `__tcp_connect`, `__tcp_accept`, `__tcp_send`,
`__tcp_recv`, `__tcp_close`, `__strlen`, `__malloc`, and `__free`, and
completes one deterministic in-process HTTP response roundtrip on
`127.0.0.1`. The HTTP response parsing fixture allows only `__strlen`,
`__parse_response`, `__str_eq`, `__malloc`, and `__free`, parses two fixed
raw HTTP responses through the runtime parser's explicit C output-buffer
ABI, and verifies the `VaisResponse` status/version/status_text/header/body
fields. The DB persistence fixture allows only `__sqlite_open`,
`__sqlite_close`, `__sqlite_exec`, `__sqlite_prepare`, `__sqlite_bind_int`,
`__sqlite_bind_text`, `__sqlite_step`, `__sqlite_column_int`,
`__sqlite_finalize`, `__sqlite_last_insert_rowid`, and `__sqlite_changes`,
and is observed through integer columns only. The next adapter task is a
small persistent request-response loop (once a narrow upstream gate covers
the exact runtime symbols required to wire `__parse_request`,
`__parse_response`, and `__call_handler` together); web data wiring is a
later slice.

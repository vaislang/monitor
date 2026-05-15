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

## Still Blocked

Do not call these runtime families from the reference app source until this
repository adds another narrowed fixture for the exact symbols being used:

- `server_listen*`
- other `__tcp_*` symbols (only `__tcp_listen`/`__tcp_close` are certified)
- other HTTP runtime symbols (only `__strlen`, `__find_header_end`,
  `__parse_request`, `__str_eq`, `__malloc`, and `__free` are certified)
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

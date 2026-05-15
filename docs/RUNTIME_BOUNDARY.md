# Runtime Boundary

The current monitor reference app intentionally stops at a pure server-domain
slice, one certified HTTP listener lifecycle fixture, and a static web shell.
The domain slice now has both IR and native smoke gates.

## Allowed Now

- Pure Vais domain code in `server/src/main.vais`
- Generic enum layout verification through `scripts/check-ir-layout.sh`
- Native domain execution through `server/build.sh --native`
- HTTP listener lifecycle through `server/src/http_adapter.vais`
  and `scripts/check-http-adapter.sh`
- Playground source synchronization through `playground/monitor.vais`
- Static web build through `web/`

## Exact Runtime Allowlist

Only these runtime symbols are currently allowed, and only inside
`server/src/http_adapter.vais`:

- `__tcp_listen`
- `__tcp_close`

They certify that the monitor app can link the public HTTP runtime and open then
close a listener. They do not certify request parsing, request routing,
response writing, DB persistence, WebSocket handling, or a long-running server.

## Still Blocked

Do not call these runtime families from the reference app source until this
repository adds another narrowed fixture for the exact symbols being used:

- `server_listen*`
- other `__tcp_*` symbols
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

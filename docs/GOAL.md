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

Current HTTP adapter certification is limited to two narrow fixtures:

- Listener open/close through `__tcp_listen` and `__tcp_close` in
  `server/src/http_adapter.vais`.
- Request parsing/routing through `__strlen`, `__find_header_end`,
  `__parse_request`, `__str_eq`, `__malloc`, and `__free` in
  `server/src/http_request.vais`. The fixture uses the runtime parser's
  explicit C ABI: a 64-byte output buffer is allocated, the parser writes
  through an out-pointer, and fields are read via the built-in `load_i64`.

This is not API response writing, persistence, accepting client connections,
or production server completion.

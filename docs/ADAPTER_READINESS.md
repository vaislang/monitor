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
complete by itself. Two monitor-specific HTTP adapter fixtures are now allowed,
each with its own narrowed symbol set:

- `server/src/http_adapter.vais` allows only `__tcp_listen`/`__tcp_close`.
- `server/src/http_request.vais` allows only `__strlen`,
  `__find_header_end`, `__parse_request`, `__str_eq`, `__malloc`, and
  `__free`. The runtime parser is invoked through its explicit C ABI: a
  64-byte `VaisRequest` output buffer is allocated through `__malloc`, the
  parser fills it through an out-pointer, fields are read via the built-in
  `load_i64`, and the buffer is released through `__free`. Vais string
  literals cross the C boundary through explicit `as i64` casts.

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
above. Broader HTTP runtime symbols (response writing, accepting connections),
DB symbols, or WebSocket symbols each need a new fixture and a matching
boundary update before they may enter `server/src` or `playground`.

If the upstream wording changes but the intended certification is equivalent,
update this script and document the exact public gate name in the same commit.

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
complete by itself. The first monitor-specific HTTP adapter fixture now allows
only listener lifecycle symbols in `server/src/http_adapter.vais`.

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

The current fixture satisfies this rule only for `__tcp_listen` and
`__tcp_close`. Broader HTTP, DB, or WS behavior needs a new fixture and a
matching boundary update.

If the upstream wording changes but the intended certification is equivalent,
update this script and document the exact public gate name in the same commit.

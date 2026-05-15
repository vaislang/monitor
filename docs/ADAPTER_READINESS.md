# Adapter Readiness

The monitor app does not add HTTP or DB adapters by inference from partial
runtime evidence. Adapter work starts only after a named public gate promotes the
single DB/server/web runtime path needed by this app shape.

## Current Decision

Status: blocked.

Current public evidence from the sibling Vais checkout:

- VaisDB runtime smoke: `34/34`
- Vais Server runtime smoke: `20/20`
- Full ecosystem runtime aggregate runner: still pending as a single
  main-reproducible DB/server/web runtime gate

The first two lines prove bounded package behavior. They do not prove that this
reference app can safely call server, database, or websocket runtime symbols
without creating link-time or semantic drift.

## Gate

Use the status check during normal verification:

```bash
scripts/check-adapter-readiness.sh
```

Before implementing HTTP or DB adapters, require promotion explicitly:

```bash
scripts/check-adapter-readiness.sh --require-promoted
```

`--require-promoted` must pass before adding calls such as `server_listen*`,
`db_*`, or `ws_*` to `server/src` or `playground`.

## Promotion Rule

A future adapter task may begin only when all of these are true:

1. `compiler/PUBLIC_STATUS.md` names a promoted single DB/server/web runtime
   main gate.
2. `scripts/check-adapter-readiness.sh --require-promoted` passes from a clean
   checkout.
3. `docs/RUNTIME_BOUNDARY.md` is updated from "blocked" to the newly certified
   app shape.
4. `scripts/check-runtime-boundary.sh` is narrowed to allow only the newly
   certified symbols, not the entire runtime family.
5. A monitor-specific runtime fixture is added before any completion claim.

If the upstream wording changes but the intended certification is equivalent,
update this script and document the exact public gate name in the same commit.

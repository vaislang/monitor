# Goal Contract

Goal: make `monitor` a reproducible Vais reference app that another AI can build
from the official Vais docs without relying on hidden project memory.

## Certified Current Scope

- Language/compiler slice: `server/src/main.vais`
- Playground sample: `playground/monitor.vais`, synchronized from the server
  source
- Web shell: `web/`
- Root gate: `scripts/check-reference-gates.sh`
- Clean-checkout gate: `scripts/check-clean-checkout.sh` after changes are
  committed
- Runtime boundary gate: `scripts/check-runtime-boundary.sh`
- Adapter readiness gate: `scripts/check-adapter-readiness.sh`
- CI template: `.github/workflows/reference-gates.yml`
- Remote: `https://github.com/vaislang/monitor`

## Acceptance Rule

No new surface is considered done until it has:

1. A named source file or fixture.
2. A deterministic local verification command.
3. Documentation that states both the certified behavior and the boundary.
4. A clean-checkout verification path.
5. Hosted CI evidence when a remote workflow surface exists.

## Blocked Surfaces

HTTP and DB adapters stay blocked until the corresponding server/db runtime
symbols have reproducible named gates for this app shape. The precondition is:

```bash
scripts/check-adapter-readiness.sh --require-promoted
```

Do not add placeholder runtime calls that only fail at link time.

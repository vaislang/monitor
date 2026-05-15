# Runtime Boundary

The current monitor reference app intentionally stops at an IR-only server-domain
slice plus a static web shell.

## Allowed Now

- Pure Vais domain code in `server/src/main.vais`
- Generic enum layout verification through `scripts/check-ir-layout.sh`
- Playground source synchronization through `playground/monitor.vais`
- Static web build through `web/`

## Blocked Until Promoted

Do not call these runtime families from the reference app source until the
compiler/public status names reproducible gates for this app shape:

- `server_listen*`
- `db_*`
- `ws_*`

`scripts/check-runtime-boundary.sh` enforces this over `server/src` and
`playground`.

## Evidence Boundary

`/Users/sswoo/study/projects/vais/compiler/PUBLIC_STATUS.md` currently lists
VaisDB and Vais Server runtime smoke evidence, but also states that the single
full ecosystem runtime aggregate runner is still pending. This app therefore
must not claim HTTP or DB integration completeness yet.

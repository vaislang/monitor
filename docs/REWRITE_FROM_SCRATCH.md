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
- `scripts/check-http-adapter.sh` now certifies only HTTP listener open/close
  wiring; broader runtime behavior remains out of scope until named fixtures
  exist.

Recover the old tree only for comparison:

```bash
git checkout legacy-before-rewrite-2026-05-15
```

Do not copy old source back into `master` without revalidating it against the
current language card and public status document.

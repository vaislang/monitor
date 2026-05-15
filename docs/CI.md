# CI And Automation

`monitor` is connected to `https://github.com/vaislang/monitor` and includes a
GitHub Actions workflow at `.github/workflows/reference-gates.yml`.

## Local Automation

Use this before committing:

```bash
scripts/check-reference-gates.sh
```

Use this after committing:

```bash
scripts/check-clean-checkout.sh
```

## Compiler Location

The gate needs a built `vaisc` binary. It resolves the compiler in this order:

1. `VAISC`
2. `VAIS_COMPILER_DIR/target/{release,debug}/vaisc`
3. Workspace defaults such as `../../vais/compiler`
4. `vaisc` on `PATH`

The GitHub Actions workflow checks out `vaislang/vais`, builds
`cargo build --release -p vaisc`, sets `VAIS_COMPILER_DIR`, then runs the
reference gates. Hosted macOS runners also install `llvm@17` and set
`LLVM_SYS_170_PREFIX` before building `vaisc`.

`ripgrep` is used when available, but the runtime-boundary gate falls back to
system `grep` so hosted runners do not need an extra package for source scans.

## Remote Boundary

Hosted CI has been verified:

- Workflow: `Monitor Reference Gates`
- Run: `https://github.com/vaislang/monitor/actions/runs/25896971067`
- Commit: `fc5a8ef` (`test: add monitor adapter readiness gate`)
- Result: passed
- Included checks: adapter readiness status, IR layout, runtime boundary,
  playground sync, and web build

Current local reference gates also include `scripts/check-http-adapter.sh`, which
links the HTTP runtime fixture with `std/http_runtime.c` before running it.
Re-run hosted CI after pushing this broadened gate.

Treat hosted CI as required evidence for future broadening when a change touches
the compiler gate, runtime-boundary gate, playground source, or web shell.

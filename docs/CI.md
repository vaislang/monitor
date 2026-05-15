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
- Run: `https://github.com/vaislang/monitor/actions/runs/25946928509`
- Commit: `5e5dd85` (`test: add monitor HTTP response fixture`)
- Result: passed
- Included checks: adapter readiness status, IR layout, native domain smoke,
  runtime boundary, HTTP adapter fixture, HTTP request fixture, HTTP response
  fixture, DB persistence fixture, playground sync, and web build

Treat hosted CI as required evidence for future broadening when a change touches
the compiler gate, runtime-boundary gate, playground source, or web shell.

# CI And Automation

`monitor` has no git remote configured in this local checkout, but the repository
now includes a GitHub Actions workflow template at
`.github/workflows/reference-gates.yml`.

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

Because this local repo currently has no remote, this workflow has not been
verified by a hosted CI run. Treat hosted CI as pending until a remote exists and
the workflow passes there.

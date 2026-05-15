# New Session Handoff

Start here:

```bash
cd /Users/sswoo/study/projects/vais-apps/monitor
git status --short --branch
scripts/check-reference-gates.sh
```

After committing changes, run:

```bash
scripts/check-clean-checkout.sh
```

After pushing changes, verify the hosted workflow:

```bash
gh run list --repo vaislang/monitor --limit 5
```

The main server slice is intentionally domain-only. It validates current Vais
language surface through IR and native smoke gates. Two separate fixtures
certify narrow HTTP runtime slices:

- `server/src/http_adapter.vais` certifies only HTTP listener open/close
  runtime wiring (`__tcp_listen`, `__tcp_close`).
- `server/src/http_request.vais` certifies only request parsing/routing on
  fixed raw HTTP strings (`__strlen`, `__find_header_end`, `__parse_request`,
  `__str_eq`, `__malloc`, `__free`). The runtime parser is called through its
  explicit C ABI: a 64-byte `VaisRequest` output buffer is allocated, the
  parser writes through an out-pointer, fields are read with the built-in
  `load_i64`, and string literals cross the C boundary through explicit
  `as i64` casts.

`playground/monitor.vais` is a synchronized copy of `server/src/main.vais`. If
the server source changes, run `scripts/sync-playground-example.sh` before the
reference gates.

The current source of truth for language and public claims is the sibling
compiler repository:

- `/Users/sswoo/study/projects/vais/compiler/docs/ai/LLM_LANGUAGE_CARD.md`
- `/Users/sswoo/study/projects/vais/compiler/docs/LANGUAGE_SPEC.md`
- `/Users/sswoo/study/projects/vais/compiler/PUBLIC_STATUS.md`
- `docs/GOAL.md`
- `docs/RUNTIME_BOUNDARY.md`
- `docs/ADAPTER_READINESS.md`
- `docs/CI.md`

If compiler behavior and docs disagree, stop and fix the compiler or docs before
adding fallback syntax here.

Before adding HTTP or DB runtime code, run:

```bash
scripts/check-adapter-readiness.sh --require-promoted
```

At the current baseline this is expected to pass. Passing this precondition only
opens adapter work; it does not replace the need for a monitor-specific runtime
fixture and a narrowed runtime-boundary gate.

The HTTP listener fixture allows only `__tcp_listen` and `__tcp_close`. The
HTTP request fixture allows only `__strlen`, `__find_header_end`,
`__parse_request`, `__str_eq`, `__malloc`, and `__free`, and uses the runtime
parser through its explicit C output-buffer ABI. The next adapter task is DB
persistence; web data wiring is a later slice.

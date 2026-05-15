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
language surface through IR and native smoke gates. Three separate fixtures
certify narrow HTTP and DB runtime slices:

- `server/src/http_adapter.vais` certifies only HTTP listener open/close
  runtime wiring (`__tcp_listen`, `__tcp_close`).
- `server/src/http_request.vais` certifies only request parsing/routing on
  fixed raw HTTP strings (`__strlen`, `__find_header_end`, `__parse_request`,
  `__str_eq`, `__malloc`, `__free`). The runtime parser is called through its
  explicit C ABI: a 64-byte `VaisRequest` output buffer is allocated, the
  parser writes through an out-pointer, fields are read with the built-in
  `load_i64`, and string literals cross the C boundary through explicit
  `as i64` casts.
- `server/src/db_persistence.vais` certifies only DB persistence on a fixed
  file database (`__sqlite_open`, `__sqlite_close`, `__sqlite_exec`,
  `__sqlite_prepare`, `__sqlite_bind_int`, `__sqlite_bind_text`,
  `__sqlite_step`, `__sqlite_column_int`, `__sqlite_finalize`,
  `__sqlite_last_insert_rowid`, `__sqlite_changes`). The fixture opens the
  database, creates `monitor_tasks`, inserts one row, closes the connection,
  reopens the file, and verifies the persisted row through `SELECT
  COUNT(*)/SUM(priority)/SUM(title_len)`. Path/SQL/text arguments cross the
  C boundary through explicit `as i64` casts.

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
parser through its explicit C output-buffer ABI. The DB persistence fixture
allows only `__sqlite_open`, `__sqlite_close`, `__sqlite_exec`,
`__sqlite_prepare`, `__sqlite_bind_int`, `__sqlite_bind_text`, `__sqlite_step`,
`__sqlite_column_int`, `__sqlite_finalize`, `__sqlite_last_insert_rowid`, and
`__sqlite_changes`, and is observed through integer columns only. The next
adapter task is HTTP response writing or client accept (once a narrow upstream
gate exists); web data wiring is a later slice.

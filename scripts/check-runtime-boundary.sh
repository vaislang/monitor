#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HTTP_ADAPTER="$ROOT_DIR/server/src/http_adapter.vais"
HTTP_REQUEST="$ROOT_DIR/server/src/http_request.vais"
HTTP_RESPONSE="$ROOT_DIR/server/src/http_response.vais"
HTTP_RESPONSE_PARSE="$ROOT_DIR/server/src/http_response_parse.vais"
HTTP_REQUEST_RESPONSE_LOOP="$ROOT_DIR/server/src/http_request_response_loop.vais"
DB_PERSISTENCE="$ROOT_DIR/server/src/db_persistence.vais"
PATTERN='\b(__tcp_[A-Za-z0-9_]+|__find_header_end|__parse_request|__parse_response|__parse_url_[A-Za-z0-9_]+|__call_handler|__strlen|__str_eq|__str_eq_ignore_case|__malloc|__free|__sqlite_[A-Za-z0-9_]+|server_listen[A-Za-z0-9_]*|db_[A-Za-z0-9_]+|ws_[A-Za-z0-9_]+)\b'
TOKEN_PATTERN='(__tcp_[A-Za-z0-9_]+|__find_header_end|__parse_request|__parse_response|__parse_url_[A-Za-z0-9_]+|__call_handler|__strlen|__str_eq|__str_eq_ignore_case|__malloc|__free|__sqlite_[A-Za-z0-9_]+|server_listen[A-Za-z0-9_]*|db_[A-Za-z0-9_]+|ws_[A-Za-z0-9_]+)'

if command -v rg >/dev/null 2>&1; then
  MATCHES="$(rg -n "$PATTERN" "$ROOT_DIR/server/src" "$ROOT_DIR/playground" || true)"
else
  MATCHES="$(grep -RInE "$TOKEN_PATTERN" "$ROOT_DIR/server/src" "$ROOT_DIR/playground" || true)"
fi

VIOLATIONS=""
while IFS= read -r match; do
  [[ -z "$match" ]] && continue

  file="${match%%:*}"
  rest="${match#*:}"
  text="${rest#*:}"

  if [[ "$file" == "$HTTP_ADAPTER" ]]; then
    disallowed="$(printf '%s\n' "$text" | grep -Eo "$TOKEN_PATTERN" | grep -Ev '^(__tcp_listen|__tcp_close)$' || true)"
    if [[ -z "$disallowed" ]]; then
      continue
    fi
  fi

  if [[ "$file" == "$HTTP_REQUEST" ]]; then
    disallowed="$(printf '%s\n' "$text" | grep -Eo "$TOKEN_PATTERN" | grep -Ev '^(__strlen|__find_header_end|__parse_request|__str_eq|__malloc|__free)$' || true)"
    if [[ -z "$disallowed" ]]; then
      continue
    fi
  fi

  if [[ "$file" == "$HTTP_RESPONSE" ]]; then
    disallowed="$(printf '%s\n' "$text" | grep -Eo "$TOKEN_PATTERN" | grep -Ev '^(__tcp_listen|__tcp_connect|__tcp_accept|__tcp_send|__tcp_recv|__tcp_close|__strlen|__malloc|__free)$' || true)"
    if [[ -z "$disallowed" ]]; then
      continue
    fi
  fi

  if [[ "$file" == "$HTTP_RESPONSE_PARSE" ]]; then
    disallowed="$(printf '%s\n' "$text" | grep -Eo "$TOKEN_PATTERN" | grep -Ev '^(__strlen|__parse_response|__str_eq|__malloc|__free)$' || true)"
    if [[ -z "$disallowed" ]]; then
      continue
    fi
  fi

  if [[ "$file" == "$HTTP_REQUEST_RESPONSE_LOOP" ]]; then
    disallowed="$(printf '%s\n' "$text" | grep -Eo "$TOKEN_PATTERN" | grep -Ev '^(__tcp_listen|__tcp_connect|__tcp_accept|__tcp_send|__tcp_recv|__tcp_close|__strlen|__find_header_end|__parse_request|__parse_response|__call_handler|__str_eq|__malloc|__free)$' || true)"
    if [[ -z "$disallowed" ]]; then
      continue
    fi
  fi

  if [[ "$file" == "$DB_PERSISTENCE" ]]; then
    disallowed="$(printf '%s\n' "$text" | grep -Eo "$TOKEN_PATTERN" | grep -Ev '^(__sqlite_open|__sqlite_close|__sqlite_exec|__sqlite_prepare|__sqlite_bind_int|__sqlite_bind_text|__sqlite_step|__sqlite_column_int|__sqlite_finalize|__sqlite_last_insert_rowid|__sqlite_changes)$' || true)"
    if [[ -z "$disallowed" ]]; then
      continue
    fi
  fi

  VIOLATIONS+="$match"$'\n'
done <<< "$MATCHES"

if [[ -n "$VIOLATIONS" ]]; then
  printf '%s' "$VIOLATIONS"
  echo "uncertified runtime symbol found in reference app source" >&2
  echo "Only __tcp_listen/__tcp_close are certified in server/src/http_adapter.vais." >&2
  echo "Only __strlen/__find_header_end/__parse_request/__str_eq/__malloc/__free are certified in server/src/http_request.vais." >&2
  echo "Only __tcp_listen/__tcp_connect/__tcp_accept/__tcp_send/__tcp_recv/__tcp_close/__strlen/__malloc/__free are certified in server/src/http_response.vais." >&2
  echo "Only __strlen/__parse_response/__str_eq/__malloc/__free are certified in server/src/http_response_parse.vais." >&2
  echo "Only __tcp_listen/__tcp_connect/__tcp_accept/__tcp_send/__tcp_recv/__tcp_close/__strlen/__find_header_end/__parse_request/__parse_response/__call_handler/__str_eq/__malloc/__free are certified in server/src/http_request_response_loop.vais." >&2
  echo "Only __sqlite_open/__sqlite_close/__sqlite_exec/__sqlite_prepare/__sqlite_bind_int/__sqlite_bind_text/__sqlite_step/__sqlite_column_int/__sqlite_finalize/__sqlite_last_insert_rowid/__sqlite_changes are certified in server/src/db_persistence.vais." >&2
  exit 1
fi

echo "runtime boundary fixture passed"

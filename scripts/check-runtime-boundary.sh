#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HTTP_ADAPTER="$ROOT_DIR/server/src/http_adapter.vais"
HTTP_REQUEST="$ROOT_DIR/server/src/http_request.vais"
PATTERN='\b(__tcp_[A-Za-z0-9_]+|__find_header_end|__parse_request|__parse_response|__parse_url_[A-Za-z0-9_]+|__call_handler|__strlen|__str_eq|__str_eq_ignore_case|__malloc|__free|server_listen[A-Za-z0-9_]*|db_[A-Za-z0-9_]+|ws_[A-Za-z0-9_]+)\b'
TOKEN_PATTERN='(__tcp_[A-Za-z0-9_]+|__find_header_end|__parse_request|__parse_response|__parse_url_[A-Za-z0-9_]+|__call_handler|__strlen|__str_eq|__str_eq_ignore_case|__malloc|__free|server_listen[A-Za-z0-9_]*|db_[A-Za-z0-9_]+|ws_[A-Za-z0-9_]+)'

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

  VIOLATIONS+="$match"$'\n'
done <<< "$MATCHES"

if [[ -n "$VIOLATIONS" ]]; then
  printf '%s' "$VIOLATIONS"
  echo "uncertified runtime symbol found in reference app source" >&2
  echo "Only __tcp_listen/__tcp_close are certified in server/src/http_adapter.vais." >&2
  echo "Only __strlen/__find_header_end/__parse_request/__str_eq/__malloc/__free are certified in server/src/http_request.vais." >&2
  exit 1
fi

echo "runtime boundary fixture passed"

#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
BUILDER_URL="${BUILDER_URL:-http://localhost:3000}"
RENDERER_URL="${RENDERER_URL:-http://localhost:3002}"

pass=0
fail=0

check() {
  local name="$1"
  local url="$2"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
  if [ "$status" = "200" ]; then
    echo "  [OK]  $name ($url)"
    ((pass++)) || true
  else
    echo "  [FAIL] $name ($url) — HTTP $status"
    ((fail++)) || true
  fi
}

echo "Portal Health Check"
echo "==================="
check "Backend"  "$BACKEND_URL/health"
check "Builder"  "$BUILDER_URL/api/health"
check "Renderer" "$RENDERER_URL/"
echo "-------------------"
echo "Passed: $pass  Failed: $fail"
echo ""

if [ "$fail" -gt 0 ]; then
  exit 1
fi

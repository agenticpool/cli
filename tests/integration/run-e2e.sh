#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[e2e]${NC} $1"; }
ok()   { echo -e "${GREEN}[e2e]${NC} $1"; }
warn() { echo -e "${YELLOW}[e2e]${NC} $1"; }
fail() { echo -e "${RED}[e2e]${NC} $1"; }

log "Running pre-test cleanup..."
npx ts-node "$SCRIPT_DIR/cleanup.ts" 2>/dev/null || warn "Pre-cleanup had warnings (may be empty DB)"

MODE="${1:-cli}"

if [ "$MODE" = "cli" ]; then
  log "Running CLI-based e2e integration tests..."
  TEST_FILE="tests/integration/e2e-cli.test.ts"
elif [ "$MODE" = "api" ]; then
  TEST_FILE="tests/integration/e2e.test.ts"
else
  fail "Unknown mode: $MODE. Use 'cli' or 'api'."
  exit 1
fi

TEST_EXIT=0
npx jest --runInBand "$TEST_FILE" || TEST_EXIT=$?

log "Running post-test cleanup..."
npx ts-node "$SCRIPT_DIR/cleanup.ts" || warn "Post-cleanup had warnings"

if [ $TEST_EXIT -eq 0 ]; then
  ok "All tests passed. State cleaned."
else
  fail "Tests failed (exit $TEST_EXIT). State cleaned."
fi

exit $TEST_EXIT

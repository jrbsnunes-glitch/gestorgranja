#!/bin/bash
# Copia variáveis da raiz para apps que não leem ../../.env automaticamente.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
test -f .env || { echo "Crie .env na raiz antes."; exit 1; }
cp .env apps/api/.env
grep -E '^(NEXT_PUBLIC_|API_UPSTREAM=)' .env > apps/web/.env.production || true
grep -E '^(NEXT_PUBLIC_|API_UPSTREAM=)' .env > apps/mobile-pwa/.env.production || true
echo "OK: apps/api/.env, apps/web/.env.production e apps/mobile-pwa/.env.production atualizados."

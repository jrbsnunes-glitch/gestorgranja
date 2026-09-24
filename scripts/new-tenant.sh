#!/usr/bin/env bash
set -euo pipefail

SLUG="${1:-}"
CNPJ="${2:-}"
COMPANY="${3:-}"
ADMIN_EMAIL="${4:-}"
ADMIN_PASSWORD="${5:-}"

if [[ -z "$SLUG" || -z "$CNPJ" || -z "$COMPANY" || -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
  echo "Uso: new-tenant.sh <slug> <cnpj> <companyName> <adminEmail> <adminPassword>"
  exit 1
fi

DB_NAME="gestorgranja_${SLUG//[^a-zA-Z0-9_]/_}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/api"

pnpm tenant:provision "$SLUG" "$CNPJ" "$COMPANY" "$DB_NAME" "$ADMIN_EMAIL" "$ADMIN_PASSWORD" 2>/dev/null || \
curl -s -X POST "http://localhost:${PORT:-3010}/api/v1/provisioning/tenants" \
  -H "Content-Type: application/json" \
  -d "{\"slug\":\"$SLUG\",\"cnpj\":\"$CNPJ\",\"companyName\":\"$COMPANY\",\"databaseName\":\"$DB_NAME\",\"adminEmail\":\"$ADMIN_EMAIL\",\"adminPassword\":\"$ADMIN_PASSWORD\"}"

echo "Tenant $SLUG provisionado (database: $DB_NAME)"

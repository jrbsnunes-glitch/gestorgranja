#!/bin/bash
# Wrapper: delega para o script de atualização na raiz do repositório.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/atgranja.sh" "$@"

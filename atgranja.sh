#!/bin/bash
# Atualização completa do GestorGranja no VPS (git, Docker, migrations, build, PM2).
set -euo pipefail

ROOT="${GESTOR_GRANJA_ROOT:-/var/www/gestorgranja}"
GIT_BRANCH="${GESTOR_GRANJA_GIT_BRANCH:-main}"
SKIP_GIT=0
SKIP_DOCKER=0

for arg in "$@"; do
  case "$arg" in
    --skip-git) SKIP_GIT=1 ;;
    --skip-docker) SKIP_DOCKER=1 ;;
    -h|--help)
      echo "Uso: ./atgranja.sh [--skip-git] [--skip-docker]"
      echo "  GESTOR_GRANJA_ROOT (padrão: /var/www/gestorgranja)"
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $arg" >&2
      exit 1
      ;;
  esac
done

cd "$ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

if [ ! -f .env ]; then
  echo "Arquivo .env não encontrado em $ROOT" >&2
  exit 1
fi

echo "[1/10] Sincronizar .env para apps..."
bash deploy/sync-env.sh

if [ "$SKIP_DOCKER" -eq 0 ]; then
  echo "[2/10] Docker Postgres/Redis..."
  docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d
else
  echo "[2/10] Docker ignorado (--skip-docker)"
fi

if [ "$SKIP_GIT" -eq 0 ]; then
  echo "[3/10] git pull origin $GIT_BRANCH..."
  git fetch origin "$GIT_BRANCH"
  git pull origin "$GIT_BRANCH"
else
  echo "[3/10] Git ignorado (--skip-git)"
fi

echo "[4/10] pnpm install..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "[5/10] Prisma generate..."
pnpm --filter @gestor-granja/api prisma:generate

echo "[6/10] Migrations central + template tenant..."
pnpm --filter @gestor-granja/api prisma:migrate:central
pnpm --filter @gestor-granja/api prisma:migrate:tenant

echo "[7/10] Migrations em todos os tenants..."
pnpm --filter @gestor-granja/api tenant:migrate-all

echo "[8/10] Build monorepo..."
pnpm build

echo "[9/10] PM2 restart..."
export GESTOR_GRANJA_ROOT="$ROOT"
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart deploy/ecosystem.config.cjs --update-env 2>/dev/null || pm2 start deploy/ecosystem.config.cjs
  sleep 5
else
  echo "PM2 não encontrado — pule restart manual se estiver em dev local." >&2
fi

echo "[10/10] Healthcheck..."
API_OK=0
WEB_OK=0
if curl -sf "http://127.0.0.1:3010/api/docs" >/dev/null 2>&1; then
  echo "API OK (3010)"
  API_OK=1
else
  echo "API não respondeu em 3010 — verifique: pm2 logs gestorgranja-api" >&2
fi
if curl -sfI "http://127.0.0.1:3020" >/dev/null 2>&1; then
  echo "Web OK (3020)"
  WEB_OK=1
else
  echo "Web não respondeu em 3020 — verifique: pm2 logs gestorgranja-web" >&2
fi

if command -v pm2 >/dev/null 2>&1; then
  pm2 status || true
fi

if [ "$API_OK" -eq 0 ] || [ "$WEB_OK" -eq 0 ]; then
  exit 1
fi

echo "Atualização concluída com sucesso."

#!/bin/bash
# Atualização completa do GestorGranja no VPS (git, Docker, migrations, build, PM2).
# Se aparecer "Permission denied": chmod +x atgranja.sh  — ou rode: bash atgranja.sh
set -euo pipefail

ROOT="${GESTOR_GRANJA_ROOT:-/var/www/gestorgranja}"
GIT_BRANCH="${GESTOR_GRANJA_GIT_BRANCH:-main}"
GIT_REMOTE="${GESTOR_GRANJA_GIT_REMOTE:-origin}"
SKIP_GIT=0
SKIP_DOCKER=0

for arg in "$@"; do
  case "$arg" in
    --skip-git) SKIP_GIT=1 ;;
    --skip-docker) SKIP_DOCKER=1 ;;
    -h|--help)
      echo "Uso: ./atgranja.sh [--skip-git] [--skip-docker]"
      echo "  GESTOR_GRANJA_ROOT (padrão: /var/www/gestorgranja)"
      echo "  GESTOR_GRANJA_GIT_BRANCH (padrão: main)"
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

# --- Git: safe.directory + fetch/pull (evita "dubious ownership" root vs deploy) ---
git_atualizar_repositorio() {
  if ! command -v git >/dev/null 2>&1; then
    echo "Git não instalado." >&2
    return 1
  fi
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "$ROOT não é um repositório git." >&2
    return 1
  fi

  echo "  git config --global --add safe.directory $ROOT"
  git config --global --add safe.directory "$ROOT"

  REPO_TOP="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  if [ -n "$REPO_TOP" ] && [ "$REPO_TOP" != "$ROOT" ]; then
    echo "  git config --global --add safe.directory $REPO_TOP"
    git config --global --add safe.directory "$REPO_TOP"
  fi

  if ! git status >/dev/null 2>&1; then
    echo "Git ainda bloqueado após safe.directory. Tente:" >&2
    echo "  chown -R deploy:deploy $ROOT" >&2
    return 1
  fi

  GIT_REF="$GIT_REMOTE/$GIT_BRANCH"

  echo "  git fetch $GIT_REMOTE $GIT_BRANCH"
  git fetch "$GIT_REMOTE" "$GIT_BRANCH"

  for f in atgranja.sh deploy/update.sh; do
    if [ -f "$f" ] && ! git diff --quiet -- "$f" 2>/dev/null; then
      echo "  git restore $f (descarta cópia local; usa GitHub)"
      git restore "$f" 2>/dev/null || git checkout -- "$f"
    fi
  done

  echo "  git pull $GIT_REMOTE $GIT_BRANCH"
  if ! git pull "$GIT_REMOTE" "$GIT_BRANCH"; then
    echo "  Pull falhou — git reset --hard $GIT_REF"
    git reset --hard "$GIT_REF"
  fi

  echo "  $(git rev-parse --short HEAD) — $(git log -1 --pretty=format:'%s')"
}

if [ "$SKIP_GIT" -eq 0 ]; then
  echo "[1/10] Git (safe.directory + pull)..."
  git_atualizar_repositorio
else
  echo "[1/10] Git ignorado (--skip-git)"
fi

if [ ! -f .env ]; then
  echo "Arquivo .env não encontrado em $ROOT" >&2
  exit 1
fi

echo "[2/10] Sincronizar .env para apps..."
bash deploy/sync-env.sh

if [ "$SKIP_DOCKER" -eq 0 ]; then
  echo "[3/10] Docker Postgres/Redis..."
  docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d
else
  echo "[3/10] Docker ignorado (--skip-docker)"
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

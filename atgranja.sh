#!/bin/bash
# Atualização completa do GestorGranja no VPS (git/GitHub, Docker, migrations, build, PM2).
# Ponto único de git no servidor: não rode git pull/fetch fora deste script.
# Pode rodar como root ou deploy: como root, corrige ownership e reexecuta como deploy.
# Se "Permission denied" ao executar: chmod +x atgranja.sh  — ou: bash atgranja.sh
set -euo pipefail

ROOT="${GESTOR_GRANJA_ROOT:-/var/www/gestorgranja}"
GIT_BRANCH="${GESTOR_GRANJA_GIT_BRANCH:-main}"
GIT_REMOTE="${GESTOR_GRANJA_GIT_REMOTE:-origin}"
DEPLOY_USER="${GESTOR_GRANJA_DEPLOY_USER:-deploy}"
SKIP_GIT=0
SKIP_DOCKER=0
AS_DEPLOY_INTERNAL=0

for arg in "$@"; do
  case "$arg" in
    --skip-git) SKIP_GIT=1 ;;
    --skip-docker) SKIP_DOCKER=1 ;;
    --as-deploy-internal) AS_DEPLOY_INTERNAL=1 ;;
    -h|--help)
      echo "Uso: bash atgranja.sh [--skip-git] [--skip-docker]"
      echo "  GESTOR_GRANJA_ROOT (padrão: /var/www/gestorgranja)"
      echo "  GESTOR_GRANJA_GIT_BRANCH (padrão: main)"
      echo "  GESTOR_GRANJA_DEPLOY_USER (padrão: deploy)"
      echo ""
      echo "Como root: ajusta chown para deploy e continua como esse usuário."
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $arg" >&2
      exit 1
      ;;
  esac
done

# --- Root: ownership + reexecutar como deploy (pnpm/pm2/git write) ---
if [ "$(id -u)" -eq 0 ] && [ "$AS_DEPLOY_INTERNAL" -eq 0 ] && id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "==> Root detectado: preparando $ROOT para usuário $DEPLOY_USER..."
  if [ ! -d "$ROOT" ]; then
    echo "Diretório não existe: $ROOT" >&2
    exit 1
  fi
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$ROOT"
  chmod -R u+rwX "$ROOT"
  chmod +x "$ROOT/atgranja.sh" "$ROOT/deploy/update.sh" "$ROOT/deploy/sync-env.sh" 2>/dev/null || true
  git config --global --add safe.directory "$ROOT" 2>/dev/null || true

  SCRIPT_ARGS=()
  for a in "$@"; do
    [ "$a" = "--as-deploy-internal" ] && continue
    SCRIPT_ARGS+=("$a")
  done
  SCRIPT_ARGS+=(--as-deploy-internal)

  echo "==> Continuando como $DEPLOY_USER (sem pedir senha do su)..."
  exec su - "$DEPLOY_USER" -c "cd '$ROOT' && export GESTOR_GRANJA_ROOT='$ROOT' && bash atgranja.sh ${SCRIPT_ARGS[*]}"
fi

cd "$ROOT"

load_node_env() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "${NVM_DIR}/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "${NVM_DIR}/nvm.sh"
    return 0
  fi
  if [ -s "/home/${DEPLOY_USER}/.nvm/nvm.sh" ]; then
    export NVM_DIR="/home/${DEPLOY_USER}/.nvm"
    # shellcheck source=/dev/null
    . "${NVM_DIR}/nvm.sh"
    return 0
  fi
  return 1
}

verificar_ambiente() {
  echo "[0/10] Verificações iniciais..."
  echo "  Usuário: $(whoami) (uid $(id -u))"
  echo "  Pasta:   $ROOT"

  if [ ! -d "$ROOT" ]; then
    echo "ROOT não existe." >&2
    exit 1
  fi

  load_node_env || {
    echo "NVM/Node não encontrado. Instale Node 20 + pnpm no usuário $(whoami)." >&2
    exit 1
  }

  if ! command -v node >/dev/null 2>&1; then
    echo "node não está no PATH após NVM." >&2
    exit 1
  fi
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm não está no PATH." >&2
    exit 1
  fi
  echo "  Node: $(node -v) | pnpm: $(pnpm -v)"

  chmod +x atgranja.sh deploy/update.sh deploy/sync-env.sh deploy/check-campo.sh deploy/reset-production-data.sh 2>/dev/null || true
}

git_verificar_escrita() {
  if [ ! -d .git/objects ]; then
    echo ".git/objects ausente." >&2
    return 1
  fi
  local owner
  owner="$(stat -c '%U:%G' .git/objects 2>/dev/null || stat -f '%Su:%Sg' .git/objects 2>/dev/null || echo '?')"
  if [ ! -w .git/objects ]; then
    echo "Sem permissão de escrita em .git/objects (dono $owner, usuário $(whoami))." >&2
    if [ "$(id -u)" -eq 0 ]; then
      chown -R "$DEPLOY_USER:$DEPLOY_USER" "$ROOT"
      chmod -R u+rwX "$ROOT"
      return 0
    fi
    echo "Como root, rode: chown -R $DEPLOY_USER:$DEPLOY_USER $ROOT" >&2
    return 1
  fi
  echo "  Permissão git OK (dono $owner)"
  return 0
}

git_verificar_github() {
  local remote_url
  remote_url="$(git remote get-url "$GIT_REMOTE" 2>/dev/null || true)"
  if [ -z "$remote_url" ]; then
    echo "Remote git '$GIT_REMOTE' não configurado." >&2
    return 1
  fi
  echo "  GitHub remote ($GIT_REMOTE): $remote_url"

  if ! git ls-remote --heads "$GIT_REMOTE" "$GIT_BRANCH" >/dev/null 2>&1; then
    echo "Falha ao contactar GitHub (git ls-remote). Rede, DNS ou credenciais do repositório." >&2
    echo "  Repositório público: confira internet e firewall." >&2
    echo "  Repositório privado: configure token SSH ou credential helper." >&2
    return 1
  fi
  echo "  GitHub OK — branch '$GIT_BRANCH' acessível no remoto"
  return 0
}

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
    git config --global --add safe.directory "$REPO_TOP"
  fi

  if ! git status >/dev/null 2>&1; then
    echo "Git bloqueado (dubious ownership). safe.directory já aplicado; verifique chown." >&2
    return 1
  fi

  git_verificar_escrita
  git_verificar_github

  GIT_REF="$GIT_REMOTE/$GIT_BRANCH"

  echo "  git fetch $GIT_REMOTE $GIT_BRANCH"
  git fetch "$GIT_REMOTE" "$GIT_BRANCH"

  for f in atgranja.sh deploy/update.sh deploy/sync-env.sh; do
    if [ -f "$f" ] && ! git diff --quiet -- "$f" 2>/dev/null; then
      echo "  git restore $f (descarta alteração local; usa GitHub)"
      git restore "$f" 2>/dev/null || git checkout -- "$f"
    fi
  done

  echo "  git pull $GIT_REMOTE $GIT_BRANCH"
  if ! git pull "$GIT_REMOTE" "$GIT_BRANCH"; then
    echo "  Pull falhou — git reset --hard $GIT_REF"
    git reset --hard "$GIT_REF"
  fi

  chmod +x atgranja.sh deploy/update.sh deploy/sync-env.sh deploy/check-campo.sh deploy/reset-production-data.sh 2>/dev/null || true
  echo "  Commit atual: $(git rev-parse --short HEAD) — $(git log -1 --pretty=format:'%s')"
}

pm2_restart_apps() {
  export GESTOR_GRANJA_ROOT="$ROOT"
  if ! command -v pm2 >/dev/null 2>&1; then
    echo "PM2 não encontrado no PATH de $(whoami)." >&2
    return 1
  fi
  # reload inclui apps novos no ecosystem (ex.: gestorgranja-campo); restart sozinho não sobe processo novo
  if pm2 reload deploy/ecosystem.config.cjs --update-env 2>/dev/null; then
    return 0
  fi
  pm2 start deploy/ecosystem.config.cjs --update-env 2>/dev/null || pm2 restart deploy/ecosystem.config.cjs --update-env
}

verificar_ambiente

if [ "$SKIP_GIT" -eq 0 ]; then
  echo "[1/10] Git + GitHub (safe.directory, fetch, pull)..."
  git_atualizar_repositorio
else
  echo "[1/10] Git ignorado (--skip-git)"
fi

if [ ! -f .env ]; then
  echo "Arquivo .env não encontrado em $ROOT" >&2
  exit 1
fi

echo "[2/10] Sincronizar .env para apps..."
DEPLOY_REV="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
if grep -q '^NEXT_PUBLIC_DEPLOY_REV=' .env; then
  sed -i "s/^NEXT_PUBLIC_DEPLOY_REV=.*/NEXT_PUBLIC_DEPLOY_REV=$DEPLOY_REV/" .env
else
  echo "NEXT_PUBLIC_DEPLOY_REV=$DEPLOY_REV" >> .env
fi
bash deploy/sync-env.sh
echo "  NEXT_PUBLIC_DEPLOY_REV=$DEPLOY_REV"

if [ "$SKIP_DOCKER" -eq 0 ]; then
  echo "[3/10] Docker Postgres/Redis..."
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker não encontrado no PATH." >&2
    exit 1
  fi
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
if pm2_restart_apps; then
  sleep 5
else
  echo "Instale PM2: npm install -g pm2 (como $(whoami))." >&2
  exit 1
fi

echo "[10/10] Healthcheck..."
API_OK=0
WEB_OK=0
CAMPO_OK=0
FAVICON_OK=0
if curl -sf "http://127.0.0.1:3010/api/docs" >/dev/null 2>&1; then
  echo "  API OK (3010)"
  API_OK=1
else
  echo "  API falhou (3010) — pm2 logs gestorgranja-api" >&2
fi
if curl -sfI "http://127.0.0.1:3020" >/dev/null 2>&1; then
  echo "  Web OK (3020)"
  WEB_OK=1
else
  echo "  Web falhou (3020) — pm2 logs gestorgranja-web" >&2
fi
if curl -sfI "http://127.0.0.1:3021/campo" >/dev/null 2>&1; then
  echo "  Campo PWA OK (3021 /campo)"
  CAMPO_OK=1
else
  echo "  Campo PWA falhou (3021) — pm2 logs gestorgranja-campo; nginx /campo/?" >&2
fi
if curl -sfI "http://127.0.0.1:3020/favicon.ico" >/dev/null 2>&1; then
  echo "  Favicon OK (/favicon.ico)"
  FAVICON_OK=1
else
  echo "  Favicon não respondeu (rebuild web necessário?)" >&2
fi

pm2 status || true

if [ "$API_OK" -eq 0 ] || [ "$WEB_OK" -eq 0 ] || [ "$CAMPO_OK" -eq 0 ]; then
  exit 1
fi

echo "Atualização concluída — revisão $DEPLOY_REV (favicon=$FAVICON_OK, campo=$CAMPO_OK)."

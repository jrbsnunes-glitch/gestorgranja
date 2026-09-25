#!/bin/bash
# Zera TODOS os dados PostgreSQL do GestorGranja no VPS (central + tenants + template).
# Licenças do portal SaaS continuam no .env; JWT e .env não são apagados.
#
# Uso (no VPS, como deploy ou root→deploy):
#   cd /var/www/gestorgranja
#   GESTORGRANJA_RESET_CONFIRM=APAGAR-TUDO bash deploy/reset-production-data.sh
#
# Depois (git/deploy — sem git pull manual):
#   bash atgranja.sh --skip-git
#
set -euo pipefail

ROOT="${GESTOR_GRANJA_ROOT:-/var/www/gestorgranja}"
cd "$ROOT"

if [ "${GESTORGRANJA_RESET_CONFIRM:-}" != "APAGAR-TUDO" ]; then
  echo "Operação cancelada." >&2
  echo "Isto apaga irreversivelmente todas as granjas, movimentos, usuários e cadastros no Postgres." >&2
  echo "Para confirmar:" >&2
  echo "  GESTORGRANJA_RESET_CONFIRM=APAGAR-TUDO bash deploy/reset-production-data.sh" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo ".env não encontrado em $ROOT" >&2
  exit 1
fi

load_node_env() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "${NVM_DIR}/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "${NVM_DIR}/nvm.sh"
    return 0
  fi
  return 1
}

echo "==> [1/6] Parando apps PM2 (libera conexões ao Postgres)..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 stop gestorgranja-api gestorgranja-painel gestorgranja-campo 2>/dev/null || true
fi

echo "==> [2/6] Removendo volume Docker do Postgres (e Redis)..."
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não encontrado." >&2
  exit 1
fi
docker compose -f deploy/docker-compose.prod.yml --env-file .env down -v

echo "==> [3/6] Subindo Postgres + Redis vazios..."
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d

DB_USER="$(grep -E '^DB_USER=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r"' || true)"
DB_USER="${DB_USER:-gestorgranja}"

echo "    Aguardando Postgres..."
for _ in $(seq 1 30); do
  if docker exec gestorgranja-postgres pg_isready -U "$DB_USER" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! docker exec gestorgranja-postgres pg_isready -U "$DB_USER" >/dev/null 2>&1; then
  echo "Postgres não ficou pronto a tempo." >&2
  exit 1
fi

echo "==> [4/6] Migrations (central + template tenant)..."
load_node_env || { echo "NVM/Node necessário (usuário deploy)." >&2; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm não encontrado." >&2; exit 1; }

pnpm --filter @gestor-granja/api prisma:generate
pnpm --filter @gestor-granja/api prisma:migrate:central
pnpm --filter @gestor-granja/api prisma:migrate:tenant

echo "==> [5/6] Provisionando tenant inicial (.env INITIAL_*)..."
pnpm --filter @gestor-granja/api seed:initial
pnpm --filter @gestor-granja/api permissions:upsert-all

echo "==> [6/6] Concluído."
echo ""
echo "Próximo passo: build + PM2 (sem git no servidor):"
echo "  cd $ROOT && bash atgranja.sh --skip-git"
echo ""
echo "Login após reset: slug = INITIAL_TENANT_SLUG do .env; admin = INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD"
echo "Cadastre galpões, lotes e usuários de campo de novo no painel."

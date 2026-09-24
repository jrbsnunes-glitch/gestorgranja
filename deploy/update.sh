#!/bin/bash
set -euo pipefail

ROOT="${GESTOR_GRANJA_ROOT:-/var/www/gestorgranja}"
cd "$ROOT"

export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "📥 [1/7] git pull..."
git pull origin main

echo "📦 [2/7] pnpm install..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "🗄️ [3/7] Prisma generate + migrations..."
pnpm --filter @gestor-granja/api prisma:generate
pnpm --filter @gestor-granja/api prisma:migrate:central
pnpm --filter @gestor-granja/api prisma:migrate:tenant
pnpm --filter @gestor-granja/api tenant:migrate-all

echo "🔨 [4/7] Build monorepo..."
pnpm build

echo "🔄 [5/7] PM2 restart..."
export GESTOR_GRANJA_ROOT="$ROOT"
pm2 restart deploy/ecosystem.config.cjs --update-env || pm2 start deploy/ecosystem.config.cjs
sleep 5

echo "✅ Deploy concluído"
pm2 status
curl -sf "http://127.0.0.1:3010/api/docs" >/dev/null && echo "API OK" || echo "Verifique logs: pm2 logs gestorgranja-api"

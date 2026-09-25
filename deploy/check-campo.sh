#!/bin/bash
# Diagnóstico rápido do PWA /campo no VPS.
set -euo pipefail

echo "=== Porta 443 (deve listar nginx) ==="
ss -tlnp 2>/dev/null | grep ':443' || echo "(nada na 443)"

echo ""
echo "=== Nginx: SSL e /campo ==="
if command -v nginx >/dev/null 2>&1; then
  sudo nginx -T 2>/dev/null | grep -E 'listen 443|location /campo|ssl_certificate ' | head -20 || echo "nginx -T falhou"
else
  echo "nginx não instalado"
fi

echo ""
echo "=== PM2 gestorgranja-campo ==="
pm2 describe gestorgranja-campo 2>/dev/null | grep -E 'status|script|PORT' || echo "processo gestorgranja-campo ausente"

echo ""
echo "=== PWA direto (3021) ==="
curl -sI http://127.0.0.1:3021/campo 2>/dev/null | head -3 || echo "3021 não responde"

echo ""
echo "=== HTTPS local → /campo ==="
curl -sSIL -o /dev/null -w "final: %{http_code}\n" --connect-timeout 5 \
  --resolve gestorgranja.com:443:127.0.0.1 https://gestorgranja.com/campo -k 2>&1 || echo "curl HTTPS falhou (000 = sem listener SSL ou nginx quebrado)"

echo ""
echo "=== HTTP :80 → /campo (Host público) ==="
curl -sI --connect-timeout 5 http://127.0.0.1/campo -H "Host: gestorgranja.com" 2>/dev/null | head -5 || true

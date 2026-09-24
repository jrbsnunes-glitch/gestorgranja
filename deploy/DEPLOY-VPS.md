# Deploy GestorGranja — VPS Hostinger

Repositório: **https://github.com/jrbsnunes-glitch/gestorgranja**

Stack real deste projeto (diferente do GestorVenda):

| Componente | Tecnologia | Porta interna |
|------------|------------|---------------|
| API | NestJS + pnpm | **3010** (`/api`) |
| Web | **Next.js 15** (SSR, não Vite estático) | **3020** |
| PostgreSQL 16 | Docker | **5440** → localhost |
| Redis 7 | Docker | **6382** → localhost |
| Proxy | Nginx → API + Next | 80 / 443 |

Se o mesmo VPS já hospeda **GestorVenda** (3000, 5433, 6380), mantenha as portas acima — não conflitam.

---

## O que você precisa fazer manualmente

1. **SSH** com chave ou senha (`root@2.25.245.118`).
2. **DNS** `gestorgranja.com` e `www` → **A** → `2.25.245.118` (Hostinger → Zona DNS).
3. **Certbot** e-mail válido (após DNS propagado).
4. **Senhas** no `.env` (nunca commitar).

O agente local **não consegue** entrar no VPS sem sua chave SSH configurada.

---

## Fase 1 — Servidor (como root)

```bash
apt update && apt upgrade -y
apt install -y curl wget git unzip ufw nginx certbot python3-certbot-nginx

adduser deploy --gecos "" --disabled-password
echo "deploy:SENHA_DEPLOY_FORTE" | chpasswd
usermod -aG sudo deploy

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

---

## Fase 2 — Node 20, pnpm, PM2, Docker (deploy)

Como **deploy** (login `su - deploy`):

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 20
nvm alias default 20
corepack enable
corepack prepare pnpm@10.33.0 --activate
npm install -g pm2
```

Como **root**:

```bash
curl -fsSL https://get.docker.com | bash
usermod -aG docker deploy
# sair e entrar de novo como deploy para grupo docker
```

---

## Fase 3 — Clonar e `.env`

```bash
sudo mkdir -p /var/www/gestorgranja
sudo chown deploy:deploy /var/www/gestorgranja
cd /var/www/gestorgranja
git clone https://github.com/jrbsnunes-glitch/gestorgranja.git .
```

Gerar segredos:

```bash
openssl rand -hex 16   # DB_PASS
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
```

```bash
cp deploy/env.production.example .env
nano .env   # preencher DB_PASS, JWT_*, INITIAL_ADMIN_*, URLs com a mesma senha
```

Subir banco:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d
docker ps
```

---

## Fase 4 — Build e migrations

```bash
cd /var/www/gestorgranja
pnpm install
pnpm --filter @gestor-granja/api prisma:generate
pnpm --filter @gestor-granja/api prisma:migrate:central
pnpm --filter @gestor-granja/api prisma:migrate:tenant
pnpm --filter @gestor-granja/api seed:initial
pnpm build
```

---

## Fase 5 — PM2

```bash
export GESTOR_GRANJA_ROOT=/var/www/gestorgranja
pm2 start deploy/ecosystem.config.cjs
pm2 status
curl -s http://127.0.0.1:3010/api/docs | head -c 80
curl -I http://127.0.0.1:3020 | head -3
pm2 startup
# executar o comando sudo que o PM2 imprimir
pm2 save
```

---

## Fase 6 — Nginx

Como **root**:

```bash
cp /var/www/gestorgranja/deploy/nginx/gestorgranja.com.conf /etc/nginx/sites-available/gestorgranja.com
ln -sf /etc/nginx/sites-available/gestorgranja.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## Fase 7 — SSL

Confirme DNS:

```bash
dig gestorgranja.com A +short @8.8.8.8
# deve retornar 2.25.245.118
```

```bash
certbot --nginx -d gestorgranja.com -d www.gestorgranja.com \
  --non-interactive --agree-tos --email SEU_EMAIL@gestorgranja.com --redirect
certbot renew --dry-run
```

---

## Login

- **Granja (slug):** valor de `INITIAL_TENANT_SLUG` (ex. `demo`)
- **Usuário:** e-mail em `INITIAL_ADMIN_EMAIL`
- **Senha:** `INITIAL_ADMIN_PASSWORD`

---

## Atualizações

```bash
chmod +x deploy/update.sh
./deploy/update.sh
```

---

## Checklist rápido

```bash
pm2 status
docker ps
curl -I https://gestorgranja.com
curl -s https://gestorgranja.com/api/docs | head -c 50
free -h
df -h /
```

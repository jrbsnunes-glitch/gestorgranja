/**
 * PM2 — GestorGranja (API + painel Next + PWA campo)
 * Caminho padrão no VPS: /var/www/gestorgranja/ecosystem.config.cjs
 */
const path = require('path');
const root = process.env.GESTOR_GRANJA_ROOT || '/var/www/gestorgranja';

module.exports = {
  apps: [
    {
      name: 'gestorgranja-api',
      script: path.join(root, 'apps/api/dist/main.js'),
      cwd: root,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_file: path.join(root, '.env'),
      env: {
        NODE_ENV: 'production',
        PORT: 3010,
      },
    },
    {
      name: 'gestorgranja-painel',
      script: path.join(root, 'apps/web/node_modules/next/dist/bin/next'),
      args: 'start --port 3020',
      cwd: path.join(root, 'apps/web'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3020,
      },
    },
    {
      name: 'gestorgranja-campo',
      script: path.join(root, 'apps/mobile-pwa/node_modules/next/dist/bin/next'),
      args: 'start --port 3021',
      cwd: path.join(root, 'apps/mobile-pwa'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3021,
      },
    },
  ],
};

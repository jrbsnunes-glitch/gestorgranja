/**
 * PM2 — GestorGranja (API + Next.js)
 * Caminho padrão: /var/www/gestorgranja
 */
const path = require('path');
const root = process.env.GESTOR_GRANJA_ROOT || '/var/www/gestorgranja';

module.exports = {
  apps: [
    {
      name: 'gestorgranja-api',
      script: 'dist/main.js',
      cwd: path.join(root, 'apps/api'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      env_file: path.join(root, '.env'),
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'gestorgranja-web',
      script: 'pnpm',
      args: '--filter @gestor-granja/web start',
      cwd: root,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      env_file: path.join(root, '.env'),
      env: {
        NODE_ENV: 'production',
        PORT: '3020',
      },
    },
  ],
};

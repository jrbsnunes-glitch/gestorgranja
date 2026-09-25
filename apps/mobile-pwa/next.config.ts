import type { NextConfig } from 'next';

const basePath = '/campo';

const nextConfig: NextConfig = {
  basePath,
  /** Canônico `/campo` (sem barra); evita loop com Nginx. */
  trailingSlash: false,
  transpilePackages: ['@gestor-granja/ui', '@gestor-granja/types'],
};

export default nextConfig;

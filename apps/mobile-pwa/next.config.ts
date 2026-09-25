import type { NextConfig } from 'next';

const basePath = '/campo';

const nextConfig: NextConfig = {
  basePath,
  transpilePackages: ['@gestor-granja/ui', '@gestor-granja/types'],
};

export default nextConfig;

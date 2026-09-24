import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@gestor-granja/ui', '@gestor-granja/types'],
};

export default nextConfig;

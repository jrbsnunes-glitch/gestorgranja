import type { NextConfig } from 'next';

const apiUpstream = (process.env.API_UPSTREAM ?? 'http://127.0.0.1:3010').replace(/\/$/, '');

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUpstream}/api/:path*` }];
  },
  async redirects() {
    return [{ source: '/cadastros/parceiros', destination: '/parceiros', permanent: false }];
  },
  transpilePackages: ['@gestor-granja/ui', '@gestor-granja/types'],
  experimental: {
    optimizePackageImports: ['@gestor-granja/ui', 'recharts'],
  },
  // Evita overlay de devtools (SegmentViewNode) que quebra HMR/Webpack no browser embutido
  devIndicators: false,
};

export default nextConfig;

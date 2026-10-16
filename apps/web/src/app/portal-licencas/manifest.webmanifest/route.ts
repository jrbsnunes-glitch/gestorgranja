import type { NextRequest } from 'next/server';

/** Manifest só do portal — URLs absolutas para instalação PWA no celular. */
export function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const start = `${origin}/portal-licencas/`;

  const manifest = {
    id: start,
    name: 'Gestor Granja — Portal de licenças',
    short_name: 'GG Licenças',
    description: 'Provisionamento e gestão de licenças SaaS',
    lang: 'pt-BR',
    start_url: start,
    scope: `${origin}/portal-licencas/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#047857',
    icons: [
      {
        src: `${origin}/branding/login-logo.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${origin}/branding/login-logo.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };

  return Response.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

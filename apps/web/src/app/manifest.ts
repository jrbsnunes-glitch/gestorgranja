import type { MetadataRoute } from 'next';
import { PRODUCT_LOGO_PATH } from '@/lib/product-branding';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gestor Granja',
    short_name: 'GestorGranja',
    description: 'Gestão avicultura de postura',
    lang: 'pt-BR',
    start_url: '/',
    display: 'standalone',
    background_color: '#ecfdf5',
    theme_color: '#047857',
    icons: [
      {
        src: PRODUCT_LOGO_PATH,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: PRODUCT_LOGO_PATH,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

import { PANEL_MENU_LOGO_PATH } from '@/lib/product-branding';

/** Ícones do menu lateral (public/). */
export const MODULE_NAV_ICONS = {
  dashboard: PANEL_MENU_LOGO_PATH,
  operacao: '/nav/operacao.svg',
  comercial: '/nav/vendas-caixa.svg',
  produtos: '/nav/produtos.svg',
  estoque: '/nav/estoque.svg',
  financeiro: '/nav/financeiro.svg',
  parceiros: '/nav/parceiros.svg',
  rh: '/nav/rh.svg',
  cadastros: '/nav/cadastros.svg',
  empresa: '/nav/empresa.svg',
  sistema: '/nav/sistema.svg',
} as const;

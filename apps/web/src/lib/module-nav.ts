import { MODULE_NAV_ICONS } from '@/lib/module-nav-icons';

export type ModuleTab = { id: string; label: string; href: string; group?: 'primary' | 'more'; icon?: string };

export type AppModule = {
  id: string;
  label: string;
  href: string;
  /** Ícone no menu lateral (public/). */
  navIcon?: string;
  match: (pathname: string) => boolean;
  tabs?: ModuleTab[];
};

function pathUnder(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function matchAny(pathname: string, bases: string[]) {
  return bases.some((b) => pathUnder(pathname, b));
}

export const APP_MODULES: AppModule[] = [
  {
    id: 'dashboard',
    label: 'Painel',
    href: '/dashboard',
    navIcon: MODULE_NAV_ICONS.dashboard,
    match: (p) => p === '/dashboard',
  },
  {
    id: 'operacao',
    label: 'Operação',
    href: '/operacao',
    navIcon: MODULE_NAV_ICONS.operacao,
    match: (p) => matchAny(p, ['/operacao', '/producao', '/sanidade', '/cadastros/galpoes', '/cadastros/lotes']),
    tabs: [
      { id: 'dashboard', label: 'Painel', href: '/operacao', group: 'primary' },
      { id: 'lotes', label: 'Lotes', href: '/cadastros/lotes', group: 'primary' },
      { id: 'producao', label: 'Produção', href: '/producao', group: 'primary' },
      { id: 'mortalidade', label: 'Mortalidade', href: '/producao?tab=mortalidade', group: 'primary' },
      { id: 'relatorios', label: 'Relatórios', href: '/operacao/relatorios', group: 'primary' },
      { id: 'registro-diario', label: 'Registro diário', href: '/operacao/registro-diario', group: 'more' },
      { id: 'galpoes', label: 'Galpões', href: '/cadastros/galpoes', group: 'more' },
      { id: 'ocorrencias', label: 'Ocorrências', href: '/operacao/ocorrencias', group: 'more' },
      { id: 'insumos', label: 'Insumos', href: '/operacao/insumos', group: 'more' },
      { id: 'perdas', label: 'Perdas', href: '/operacao/perdas', group: 'more' },
      { id: 'pendencias', label: 'Pendências', href: '/operacao/pendencias', group: 'more' },
      { id: 'sanidade', label: 'Sanidade', href: '/sanidade', group: 'more' },
      { id: 'configuracoes', label: 'Configurações', href: '/operacao/configuracoes', group: 'more' },
    ],
  },
  {
    id: 'comercial',
    label: 'Vendas e Caixas',
    href: '/vendas',
    navIcon: MODULE_NAV_ICONS.comercial,
    match: (p) => pathUnder(p, '/vendas'),
    tabs: [
      { id: 'vendas', label: 'Vendas', href: '/vendas' },
      { id: 'caixa', label: 'Caixa', href: '/vendas/caixa' },
      { id: 'fiscal', label: 'Documentos fiscais', href: '/vendas/documentos-fiscais' },
    ],
  },
  {
    id: 'produtos',
    label: 'Produtos e Materiais',
    href: '/produtos',
    navIcon: MODULE_NAV_ICONS.produtos,
    match: (p) => pathUnder(p, '/produtos'),
  },
  {
    id: 'estoque',
    label: 'Estoque',
    href: '/estoque',
    navIcon: MODULE_NAV_ICONS.estoque,
    match: (p) => matchAny(p, ['/estoque', '/compras']),
    tabs: [
      { id: 'dashboard', label: 'Visão geral', href: '/estoque' },
      { id: 'movimentos', label: 'Movimentações', href: '/estoque/movimentos' },
      { id: 'entradas', label: 'Entradas (NF)', href: '/estoque/entradas' },
      { id: 'compras', label: 'Compras (pedidos)', href: '/compras' },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    href: '/financeiro/visao',
    navIcon: MODULE_NAV_ICONS.financeiro,
    match: (p) => pathUnder(p, '/financeiro'),
    tabs: [
      { id: 'visao', label: 'Visão geral', href: '/financeiro/visao' },
      { id: 'pagar', label: 'Contas a pagar', href: '/financeiro/pagar' },
      { id: 'receber', label: 'Contas a receber', href: '/financeiro/receber' },
      { id: 'fluxo', label: 'Fluxo', href: '/financeiro/fluxo' },
      { id: 'bancos', label: 'Bancos', href: '/financeiro/bancos' },
    ],
  },
  {
    id: 'parceiros',
    label: 'Parceiros',
    href: '/parceiros',
    navIcon: MODULE_NAV_ICONS.parceiros,
    match: (p) => pathUnder(p, '/parceiros') || pathUnder(p, '/cadastros/parceiros'),
  },
  {
    id: 'rh',
    label: 'Recursos Humanos',
    href: '/rh/funcionarios',
    navIcon: MODULE_NAV_ICONS.rh,
    match: (p) => pathUnder(p, '/rh'),
    tabs: [
      { id: 'funcionarios', label: 'Funcionários', href: '/rh/funcionarios' },
      { id: 'atestados', label: 'Atestados / afastamentos', href: '/rh/atestados' },
      { id: 'ferias', label: 'Férias', href: '/rh/ferias' },
      { id: 'retiradas', label: 'Retiradas (folha)', href: '/rh/retiradas' },
      { id: 'adiantamentos', label: 'Adiantamentos', href: '/rh/adiantamentos' },
      { id: 'folha', label: 'Folha de pagamento', href: '/rh/folha' },
      { id: 'folha-rubricas', label: 'Rubricas (eSocial)', href: '/rh/folha/rubricas' },
      { id: 'ponto', label: 'Ponto (QR)', href: '/rh/ponto' },
      { id: 'terminal', label: 'Terminal portaria', href: '/rh/ponto/terminal' },
    ],
  },
  {
    id: 'cadastros',
    label: 'Cadastros',
    href: '/cadastros-gerais',
    navIcon: MODULE_NAV_ICONS.cadastros,
    match: (p) =>
      matchAny(p, [
        '/cadastros-gerais',
        '/cadastros/turnos',
        '/cadastros/plano-contas',
        '/cadastros/formas-pagamento',
        '/cadastros/situacao-fiscal',
        '/cadastros/natureza-operacao',
      ]),
    tabs: [
      { id: 'gerais', label: 'Cadastros gerais', href: '/cadastros-gerais' },
      { id: 'fiscal-sit', label: 'Situação fiscal', href: '/cadastros/situacao-fiscal' },
      { id: 'nat-op', label: 'Natureza da operação', href: '/cadastros/natureza-operacao' },
      { id: 'turnos', label: 'Turnos', href: '/cadastros/turnos' },
      { id: 'plano', label: 'Plano de contas', href: '/cadastros/plano-contas' },
      { id: 'pagamento', label: 'Formas de pagamento', href: '/cadastros/formas-pagamento' },
    ],
  },
  {
    id: 'empresa',
    label: 'Dados da Empresa',
    href: '/empresa',
    navIcon: MODULE_NAV_ICONS.empresa,
    match: (p) => pathUnder(p, '/empresa'),
    tabs: [
      { id: 'cadastro', label: 'Cadastro', href: '/empresa' },
      { id: 'fiscal', label: 'Emissor fiscal', href: '/empresa/fiscal' },
      { id: 'boletos', label: 'Boletos Sicoob', href: '/empresa/boletos' },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    href: '/usuarios',
    navIcon: MODULE_NAV_ICONS.sistema,
    match: (p) => matchAny(p, ['/usuarios', '/alertas', '/logs', '/sync-conflicts']),
    tabs: [
      { id: 'usuarios', label: 'Usuários', href: '/usuarios' },
      { id: 'alertas', label: 'Alertas', href: '/alertas' },
      { id: 'logs', label: 'Logs', href: '/logs' },
      { id: 'sync', label: 'Sync conflitos', href: '/sync-conflicts' },
    ],
  },
];

export function moduleForPath(pathname: string): AppModule | undefined {
  return APP_MODULES.find((m) => m.match(pathname));
}

function tabPath(href: string) {
  return href.split('?')[0];
}

/** Aba ativa: query específica (ex. mortalidade) ganha de um href só com o caminho. */
export function activeModuleTabId(pathname: string, tabs: ModuleTab[], search = ''): string {
  const have = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  let bestId = tabs[0]?.id ?? '';
  let bestScore = -1;
  for (const t of tabs) {
    const path = tabPath(t.href);
    const under = pathname === path || pathname.startsWith(`${path}/`);
    if (!under) continue;
    const want = new URLSearchParams(t.href.split('?')[1] ?? '');
    const keys = [...want.keys()];
    if (keys.length) {
      const ok = keys.every((k) => have.get(k) === want.get(k));
      if (!ok) continue;
      const score = 1000 + path.length;
      if (score > bestScore) {
        bestScore = score;
        bestId = t.id;
      }
      continue;
    }
    if (path.length > bestScore) {
      bestScore = path.length;
      bestId = t.id;
    }
  }
  return bestId;
}

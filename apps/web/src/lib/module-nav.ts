export type ModuleTab = { id: string; label: string; href: string };

export type AppModule = {
  id: string;
  label: string;
  href: string;
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
    match: (p) => p === '/dashboard',
  },
  {
    id: 'operacao',
    label: 'Operação',
    href: '/operacao',
    match: (p) => matchAny(p, ['/operacao', '/producao', '/sanidade', '/cadastros/galpoes', '/cadastros/lotes']),
    tabs: [
      { id: 'dashboard', label: 'Visão geral', href: '/operacao' },
      { id: 'registro-diario', label: 'Registro diário', href: '/operacao/registro-diario' },
      { id: 'producao', label: 'Produção', href: '/producao' },
      { id: 'lotes', label: 'Lotes / plantel', href: '/cadastros/lotes' },
      { id: 'galpoes', label: 'Galpões', href: '/cadastros/galpoes' },
      { id: 'ocorrencias', label: 'Ocorrências', href: '/operacao/ocorrencias' },
      { id: 'insumos', label: 'Insumos', href: '/operacao/insumos' },
      { id: 'perdas', label: 'Perdas', href: '/operacao/perdas' },
      { id: 'pendencias', label: 'Pendências', href: '/operacao/pendencias' },
      { id: 'sanidade', label: 'Sanidade', href: '/sanidade' },
      { id: 'configuracoes', label: 'Configurações', href: '/operacao/configuracoes' },
    ],
  },
  {
    id: 'produtos',
    label: 'Produtos e materiais',
    href: '/produtos',
    match: (p) => pathUnder(p, '/produtos'),
  },
  {
    id: 'estoque',
    label: 'Estoque',
    href: '/estoque',
    match: (p) => matchAny(p, ['/estoque', '/compras']),
    tabs: [
      { id: 'movimentos', label: 'Movimentações', href: '/estoque' },
      { id: 'entradas', label: 'Entradas (NF)', href: '/estoque/entradas' },
      { id: 'compras', label: 'Compras (pedidos)', href: '/compras' },
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    href: '/vendas',
    match: (p) => pathUnder(p, '/vendas'),
    tabs: [{ id: 'vendas', label: 'Vendas', href: '/vendas' }],
  },
  {
    id: 'parceiros',
    label: 'Parceiros',
    href: '/parceiros',
    match: (p) => pathUnder(p, '/parceiros') || pathUnder(p, '/cadastros/parceiros'),
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    href: '/financeiro/visao',
    match: (p) => pathUnder(p, '/financeiro'),
    tabs: [
      { id: 'visao', label: 'Visão', href: '/financeiro/visao' },
      { id: 'pagar', label: 'Pagar', href: '/financeiro/pagar' },
      { id: 'receber', label: 'Receber', href: '/financeiro/receber' },
      { id: 'caixa', label: 'Caixa', href: '/financeiro/caixa' },
      { id: 'fluxo', label: 'Fluxo', href: '/financeiro/fluxo' },
      { id: 'bancos', label: 'Bancos', href: '/financeiro/bancos' },
    ],
  },
  {
    id: 'rh',
    label: 'Recursos humanos',
    href: '/rh/funcionarios',
    match: (p) => pathUnder(p, '/rh'),
    tabs: [
      { id: 'funcionarios', label: 'Funcionários', href: '/rh/funcionarios' },
      { id: 'atestados', label: 'Atestados / afastamentos', href: '/rh/atestados' },
      { id: 'ferias', label: 'Férias', href: '/rh/ferias' },
      { id: 'retiradas', label: 'Retiradas (folha)', href: '/rh/retiradas' },
      { id: 'folha', label: 'Folha de pagamento', href: '/rh/folha' },
      { id: 'folha-rubricas', label: 'Rubricas (eSocial)', href: '/rh/folha/rubricas' },
      { id: 'ponto', label: 'Ponto (QR)', href: '/rh/ponto' },
      { id: 'terminal', label: 'Terminal portaria', href: '/rh/ponto/terminal' },
    ],
  },
  {
    id: 'empresa',
    label: 'Dados da empresa',
    href: '/empresa',
    match: (p) => pathUnder(p, '/empresa'),
  },
  {
    id: 'cadastros',
    label: 'Cadastros',
    href: '/cadastros-gerais',
    match: (p) => matchAny(p, ['/cadastros-gerais', '/cadastros/turnos', '/cadastros/plano-contas']),
    tabs: [
      { id: 'gerais', label: 'Cadastros gerais', href: '/cadastros-gerais' },
      { id: 'turnos', label: 'Turnos', href: '/cadastros/turnos' },
      { id: 'plano', label: 'Plano de contas', href: '/cadastros/plano-contas' },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    href: '/usuarios',
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

export function activeModuleTabId(pathname: string, tabs: ModuleTab[]): string {
  const hits = tabs.filter((t) => pathUnder(pathname, t.href));
  if (!hits.length) return tabs[0].id;
  hits.sort((a, b) => b.href.length - a.href.length);
  return hits[0].id;
}

/** Referência para ovos frescos (AM) — validar com contador antes de produção. */
export const FISCAL_EGG_DEFAULTS = {
  ncm: '04072100',
  cfopInternal: '5102',
  cfopExternal: '6102',
  fiscalOrigin: '0',
  fiscalCst: '102',
  ibsCst: '200',
  ibsClassTrib: '200022',
  municipalIbgeManaus: '1302603',
} as const;

/** Seed migration 20260929220000_fiscal_catalog_reorg */
export const DEFAULT_OPERATION_NATURE_ID = 'f1a10001-0000-4000-8000-000000000001';
export const DEFAULT_FISCAL_SITUATION_ID = 'f1a20001-0000-4000-8000-000000000001';

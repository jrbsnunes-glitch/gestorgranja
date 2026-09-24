import { APP_MODULES } from '@/lib/module-nav';

/** Título padrão enquanto a página ainda não chamou useShellTitle. */
export function defaultShellTitleForPath(pathname: string): string {
  for (const mod of APP_MODULES) {
    if (mod.match(pathname)) return mod.label;
  }
  return 'GestorGranja';
}

'use client';

import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';

type ShellTitleState = { title: string; description?: string };

const ShellTitleContext = createContext<{
  state: ShellTitleState;
  setState: (s: ShellTitleState) => void;
} | null>(null);

export function ShellTitleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ShellTitleState>({ title: 'GestorGranja' });
  const value = useMemo(() => ({ state, setState }), [state]);
  return <ShellTitleContext.Provider value={value}>{children}</ShellTitleContext.Provider>;
}

export function useShellTitleContext() {
  const ctx = useContext(ShellTitleContext);
  if (!ctx) throw new Error('ShellTitleProvider ausente');
  return ctx;
}

/** Define título do header mobile / desktop (chamar no topo de cada página). */
export function useShellTitle(title: string, description?: string) {
  const { setState } = useShellTitleContext();
  useLayoutEffect(() => {
    setState({ title, description });
  }, [title, description, setState]);
}

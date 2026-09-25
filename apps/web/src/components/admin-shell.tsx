'use client';

import { useEffect, useState } from 'react';
import { AppNav } from '@/components/app-nav';
import { SidebarBrand } from '@/components/sidebar-brand';
import { useShellTitle, useShellTitleContext } from '@/components/shell-title-context';
import { getToken, logout, requireAuth } from '@/lib/auth';
import { readSession, sessionDisplayName } from '@/lib/session';
import { useIsMobile } from '@/lib/use-mobile';

/** Frame persistente (layout) — não desmonta entre navegações. */
export function AdminShellFrame({ children }: { children: React.ReactNode }) {
  const { state } = useShellTitleContext();
  const [authOk, setAuthOk] = useState(() => typeof window !== 'undefined' && !!getToken());
  const [navOpen, setNavOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!getToken()) {
      requireAuth();
      return;
    }
    setAuthOk(true);
  }, []);

  useEffect(() => {
    if (!isMobile) setNavOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  if (!authOk) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">
        Carregando…
      </div>
    );
  }

  const title = state.title;
  const description = state.description;
  const displayName = sessionDisplayName(readSession());

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-6 flex items-start justify-between gap-2">
        <SidebarBrand />
        {isMobile ? (
          <button
            type="button"
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Fechar menu"
            onClick={() => setNavOpen(false)}
          >
            ✕
          </button>
        ) : null}
      </div>
      <AppNav onNavigate={() => setNavOpen(false)} />
      <div className="mt-auto border-t border-slate-100 pt-4">
        {displayName ? (
          <p className="mb-2 truncate px-1 text-sm font-medium text-slate-800" title={displayName}>
            {displayName}
          </p>
        ) : null}
        <button
          type="button"
          onClick={logout}
          className="w-full min-h-11 rounded-md border border-slate-200 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
        >
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col md:flex-row">
      {isMobile ? (
        <>
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-3 safe-top">
            <button
              type="button"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-slate-200 text-slate-700"
              aria-label="Abrir menu"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              ☰
            </button>
            <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">{title}</h1>
          </header>
          {navOpen ? (
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/40"
              aria-label="Fechar menu"
              onClick={() => setNavOpen(false)}
            />
          ) : null}
          <aside
            className={`fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,17.5rem)] transform flex-col border-r border-slate-200 bg-white p-4 shadow-xl transition-transform duration-200 ease-out safe-top safe-bottom ${
              navOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            {sidebar}
          </aside>
        </>
      ) : (
        <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4">{sidebar}</aside>
      )}

      <main className="flex-1 p-3 pb-6 md:p-6 md:pb-8 safe-bottom">
        {!isMobile ? (
          <header className="mb-6">
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </header>
        ) : null}
        {children}
      </main>
    </div>
  );
}

/**
 * Marca título da página e renderiza conteúdo.
 * O chrome (menu) fica em AdminShellFrame via AppChrome.
 */
export function AdminShell({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
}) {
  useShellTitle(title, description);
  return <>{children}</>;
}

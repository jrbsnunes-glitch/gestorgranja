'use client';

import { ModuleSectionTabs } from '@/components/module-section-tabs';

export function PageIntro({
  title,
  description,
  showModuleTabs = true,
}: {
  title: string;
  description?: string;
  /** Abas do módulo (Pagar/Receber, etc.) abaixo do título. */
  showModuleTabs?: boolean;
}) {
  return (
    <header className="mb-4">
      <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">{title}</h1>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      {showModuleTabs ? <ModuleSectionTabs /> : null}
    </header>
  );
}

'use client';

import { Button, Card } from '@gestor-granja/ui';
import Image from 'next/image';
import Link from 'next/link';
import { PRODUCT_LOGO_PATH } from '@/lib/product-branding';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { inputClass } from '@/components/ui-parts';
import {
  archivePortalTenant,
  clearPortalToken,
  fetchPortalPlans,
  fetchPortalTenants,
  formatBrl,
  getPortalToken,
  pausePortalLicense,
  type PortalPlan,
  type PortalTenant,
  type PortalTotals,
  provisionPortalTenant,
  revalidatePortalLicense,
  updatePortalAdminPassword,
  updatePortalTenant,
} from '@/lib/license-portal-api';
import { EditTenantModal } from '@/components/license-portal/edit-tenant-modal';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function LicensePortalDashboard() {
  const router = useRouter();
  const [items, setItems] = useState<PortalTenant[]>([]);
  const [totals, setTotals] = useState<PortalTotals | null>(null);
  const [plans, setPlans] = useState<PortalPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [editing, setEditing] = useState<PortalTenant | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    const [tenantRes, planList] = await Promise.allSettled([fetchPortalTenants(), fetchPortalPlans()]);
    if (tenantRes.status === 'fulfilled') {
      setItems(tenantRes.value.items);
      setTotals(tenantRes.value.totals);
    } else {
      throw tenantRes.reason;
    }
    if (planList.status === 'fulfilled') {
      setPlans(planList.value);
    } else {
      throw planList.reason;
    }
  }, []);

  useEffect(() => {
    if (!getPortalToken()) {
      router.replace('/portal-licencas');
      return;
    }
    reload()
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [router, reload]);

  function logout() {
    clearPortalToken();
    router.push('/portal-licencas');
  }

  async function runAction(slug: string, fn: () => Promise<unknown>) {
    setBusySlug(slug);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na operação');
    } finally {
      setBusySlug(null);
    }
  }

  async function onNewClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const slug = String(fd.get('slug')).trim();
    try {
      await provisionPortalTenant({
        slug,
        cnpj: String(fd.get('cnpj')).trim(),
        companyName: String(fd.get('companyName')).trim(),
        databaseName: (() => {
          const raw = String(fd.get('databaseName') ?? '').trim();
          if (!raw) return `gestorgranja_${slug.replace(/-/g, '_')}`;
          const lower = raw.toLowerCase();
          if (lower.startsWith('gestorgranja_')) return lower;
          return `gestorgranja_${lower.replace(/-/g, '_')}`;
        })(),
        adminEmail: String(fd.get('adminEmail')).trim(),
        adminPassword: String(fd.get('adminPassword')),
        adminName: String(fd.get('adminName') || '').trim() || undefined,
        commercialPlan: String(fd.get('commercialPlan') || 'basic'),
        contractEntryFeeBrl: Number(fd.get('contractEntryFeeBrl') || 0),
        contractMonthlyFeeBrl: Number(fd.get('contractMonthlyFeeBrl') || 0),
      });
      setShowNew(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao provisionar');
    }
  }

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-sm text-slate-600">Carregando clientes…</p>
      </main>
    );
  }

  async function saveEdit(payload: Record<string, unknown>) {
    if (!editing) return;
    setSavingEdit(true);
    setError(null);
    try {
      await updatePortalTenant(editing.slug, payload);
      setEditing(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar');
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <>
      {editing ? (
        <EditTenantModal
          tenant={editing}
          plans={plans}
          saving={savingEdit}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      ) : null}
      <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Image
              src={PRODUCT_LOGO_PATH}
              alt="Gestor Granja"
              width={160}
              height={48}
              className="hidden h-10 w-auto object-contain sm:block"
            />
            <div>
              <h1 className="text-xl font-bold text-slate-900">Portal de licenças</h1>
              <p className="text-sm text-slate-600">Clientes ativos e valores contratados</p>
              {process.env.NEXT_PUBLIC_DEPLOY_REV ? (
                <p className="text-[10px] text-slate-400">versão {process.env.NEXT_PUBLIC_DEPLOY_REV}</p>
              ) : null}
            </div>
          </div>
          {totals ? (
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="rounded-lg bg-emerald-50 px-4 py-2">
                <span className="block text-slate-600">Total entradas</span>
                <span className="text-lg font-semibold text-emerald-900">{formatBrl(totals.entryFeeBrl)}</span>
              </div>
              <div className="rounded-lg bg-teal-50 px-4 py-2">
                <span className="block text-slate-600">Total mensalidades</span>
                <span className="text-lg font-semibold text-teal-900">
                  {formatBrl(totals.monthlyFeeBrl)}/mês
                </span>
              </div>
              <div className="rounded-lg bg-slate-100 px-4 py-2">
                <span className="block text-slate-600">Clientes (active/trial)</span>
                <span className="text-lg font-semibold">{totals.activeClientCount}</span>
              </div>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" onClick={() => setShowNew((v) => !v)}>
              {showNew ? 'Fechar formulário' : 'Novo cliente'}
            </Button>
            <Button type="button" variant="secondary" onClick={logout}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        {showNew ? (
          <Card title="Provisionar novo cliente">
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={onNewClient}>
              <input name="slug" placeholder="Slug (ex. fazenda-sol)" className={inputClass} required />
              <input name="cnpj" placeholder="CNPJ" className={inputClass} required />
              <input name="companyName" placeholder="Razão social" className={`${inputClass} sm:col-span-2`} required />
              <input
                name="databaseName"
                placeholder="Banco (opcional — vazio = gestorgranja_&lt;slug&gt;)"
                className={inputClass}
              />
              <p className="text-xs text-slate-500 sm:col-span-2">
                Se preencher só o nome (ex.: aurora), será usado <strong>gestorgranja_aurora</strong>.
              </p>
              <select name="commercialPlan" className={inputClass} defaultValue="basic">
                {plans.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                    {p.includesPayroll ? ' (ponto + folha)' : ' (sem ponto/folha)'}
                  </option>
                ))}
              </select>
              <input
                name="contractEntryFeeBrl"
                type="number"
                min={0}
                placeholder="Entrada (R$)"
                className={inputClass}
                required
              />
              <input
                name="contractMonthlyFeeBrl"
                type="number"
                min={0}
                placeholder="Mensalidade (R$)"
                className={inputClass}
                required
              />
              <input name="adminEmail" type="email" placeholder="E-mail admin" className={inputClass} required />
              <input name="adminName" placeholder="Nome admin (opcional)" className={inputClass} />
              <input
                name="adminPassword"
                type="password"
                placeholder="Senha admin inicial"
                className={inputClass}
                required
                minLength={6}
              />
              <div className="sm:col-span-2">
                <Button type="submit">Provisionar</Button>
              </div>
            </form>
          </Card>
        ) : null}

        <Card title={`Clientes (${items.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="py-2 pr-3 font-medium">Slug</th>
                  <th className="py-2 pr-3 font-medium">Empresa</th>
                  <th className="py-2 pr-3 font-medium">Plano</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Validade</th>
                  <th className="py-2 pr-3 font-medium">Entrada</th>
                  <th className="py-2 pr-3 font-medium">Mensal</th>
                  <th className="py-2 pr-3 font-medium">Admin</th>
                  <th className="py-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 align-top">
                    <td className="py-3 pr-3 font-mono text-xs">{t.slug}</td>
                    <td className="py-3 pr-3">{t.companyName}</td>
                    <td className="py-3 pr-3">{t.planLabel}</td>
                    <td className="py-3 pr-3">{t.licenseStatus}</td>
                    <td className="py-3 pr-3">{formatDate(t.licenseExpiresAt)}</td>
                    <td className="py-3 pr-3">{formatBrl(t.entryFeeBrl)}</td>
                    <td className="py-3 pr-3">{formatBrl(t.monthlyFeeBrl)}</td>
                    <td className="py-3 pr-3 text-xs">{t.provisionAdminEmail ?? '—'}</td>
                    <td className="py-3">
                      <div className="flex max-w-[260px] flex-wrap gap-1">
                        <ActionBtn
                          label="Editar"
                          highlight
                          disabled={busySlug === t.slug}
                          onClick={() => setEditing(t)}
                        />
                        <ActionBtn
                          label="Revalidar"
                          disabled={busySlug === t.slug}
                          onClick={() => runAction(t.slug, () => revalidatePortalLicense(t.slug))}
                        />
                        <ActionBtn
                          label="Pausar"
                          disabled={busySlug === t.slug}
                          onClick={() => runAction(t.slug, () => pausePortalLicense(t.slug))}
                        />
                        <ActionBtn
                          label="Senha admin"
                          disabled={busySlug === t.slug}
                          onClick={() => {
                            const pwd = window.prompt('Nova senha do administrador (mín. 6 caracteres):');
                            if (!pwd || pwd.length < 6) return;
                            void runAction(t.slug, () => updatePortalAdminPassword(t.slug, pwd));
                          }}
                        />
                        <ActionBtn
                          label="Excluir"
                          disabled={busySlug === t.slug}
                          onClick={() => {
                            const confirmSlug = window.prompt(
                              `Digite "${t.slug}" para arquivar este cliente:`,
                            );
                            if (confirmSlug !== t.slug) return;
                            void runAction(t.slug, () => archivePortalTenant(t.slug));
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      Nenhum cliente cadastrado.{' '}
                      <button type="button" className="text-emerald-700 underline" onClick={() => setShowNew(true)}>
                        Provisionar o primeiro
                      </button>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <p className="text-center text-xs text-slate-500">
          <Link href="/" className="underline">
            Voltar ao login da granja
          </Link>
        </p>
      </main>
    </>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  highlight,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        highlight
          ? 'rounded border border-emerald-600 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50'
          : 'rounded border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50'
      }
    >
      {label}
    </button>
  );
}

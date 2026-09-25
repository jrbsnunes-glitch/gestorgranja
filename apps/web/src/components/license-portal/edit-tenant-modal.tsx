'use client';

import { Button, Card } from '@gestor-granja/ui';
import { FormEvent } from 'react';
import { inputClass } from '@/components/ui-parts';
import type { PortalPlan, PortalTenant } from '@/lib/license-portal-api';

function toDateInputValue(iso: string | null) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

type Props = {
  tenant: PortalTenant;
  plans: PortalPlan[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

export function EditTenantModal({ tenant, plans, saving, onClose, onSave }: Props) {
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const licenseExpiresRaw = String(fd.get('licenseExpiresAt') || '').trim();
    await onSave({
      companyName: String(fd.get('companyName')).trim(),
      cnpj: String(fd.get('cnpj')).trim(),
      commercialPlan: String(fd.get('commercialPlan')),
      licenseStatus: String(fd.get('licenseStatus')),
      licenseExpiresAt: licenseExpiresRaw || null,
      provisionAdminEmail: String(fd.get('provisionAdminEmail')).trim(),
      billingDay: Number(fd.get('billingDay')),
      contractEntryFeeBrl: Number(fd.get('contractEntryFeeBrl')),
      contractMonthlyFeeBrl: Number(fd.get('contractMonthlyFeeBrl')),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-tenant-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <Card title={`Editar — ${tenant.slug}`}>
          <p id="edit-tenant-title" className="sr-only">
            Editar cliente {tenant.slug}
          </p>
          <form className="flex flex-col gap-3" onSubmit={onSubmit}>
            <label className="text-xs text-slate-600">
              Razão social
              <input
                name="companyName"
                className={`${inputClass} mt-1`}
                defaultValue={tenant.companyName}
                required
              />
            </label>
            <label className="text-xs text-slate-600">
              CNPJ
              <input name="cnpj" className={`${inputClass} mt-1`} defaultValue={tenant.cnpj} required />
            </label>
            <label className="text-xs text-slate-600">
              Plano
              <select name="commercialPlan" className={`${inputClass} mt-1`} defaultValue={tenant.commercialPlan}>
                {plans.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-600">
                Entrada (R$)
                <input
                  name="contractEntryFeeBrl"
                  type="number"
                  min={0}
                  step={1}
                  className={`${inputClass} mt-1`}
                  defaultValue={tenant.entryFeeBrl}
                  required
                />
              </label>
              <label className="text-xs text-slate-600">
                Mensalidade (R$)
                <input
                  name="contractMonthlyFeeBrl"
                  type="number"
                  min={0}
                  step={1}
                  className={`${inputClass} mt-1`}
                  defaultValue={tenant.monthlyFeeBrl}
                  required
                />
              </label>
            </div>
            <label className="text-xs text-slate-600">
              Status da licença
              <select name="licenseStatus" className={`${inputClass} mt-1`} defaultValue={tenant.licenseStatus}>
                <option value="trial">trial</option>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="expired">expired</option>
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Validade (licença)
              <input
                name="licenseExpiresAt"
                type="date"
                className={`${inputClass} mt-1`}
                defaultValue={toDateInputValue(tenant.licenseExpiresAt)}
              />
            </label>
            <label className="text-xs text-slate-600">
              E-mail admin (referência)
              <input
                name="provisionAdminEmail"
                type="email"
                className={`${inputClass} mt-1`}
                defaultValue={tenant.provisionAdminEmail ?? ''}
              />
            </label>
            <label className="text-xs text-slate-600">
              Dia de cobrança
              <input
                name="billingDay"
                type="number"
                min={1}
                max={28}
                className={`${inputClass} mt-1`}
                defaultValue={tenant.billingDay ?? 10}
              />
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
              <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

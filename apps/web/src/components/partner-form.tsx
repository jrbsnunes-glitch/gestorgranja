'use client';

import { useCallback, useState } from 'react';
import { Field, SubmitButton, inputClass } from '@/components/ui-parts';
import { fetchAddressByCep, formatCep } from '@/lib/viacep';

export type PartnerFormValues = {
  personType: 'PF' | 'PJ';
  name: string;
  tradeName: string;
  cpf: string;
  cnpj: string;
  email: string;
  phone: string;
  mobile: string;
  stateRegistration: string;
  zipCode: string;
  street: string;
  addressNumber: string;
  addressComplement: string;
  district: string;
  city: string;
  state: string;
};

export const emptyPartnerForm = (personType: 'PF' | 'PJ' = 'PJ'): PartnerFormValues => ({
  personType,
  name: '',
  tradeName: '',
  cpf: '',
  cnpj: '',
  email: '',
  phone: '',
  mobile: '',
  stateRegistration: '',
  zipCode: '',
  street: '',
  addressNumber: '',
  addressComplement: '',
  district: '',
  city: '',
  state: '',
});

export function partnerToForm(p: Partial<PartnerFormValues> & { personType?: string }): PartnerFormValues {
  return {
    ...emptyPartnerForm((p.personType as 'PF' | 'PJ') ?? 'PJ'),
    ...p,
    personType: (p.personType as 'PF' | 'PJ') ?? 'PJ',
    zipCode: p.zipCode ? formatCep(p.zipCode) : '',
  };
}

export function PartnerForm({
  initial,
  submitLabel,
  onSubmit,
  showStateRegistration,
  formId,
  hideSubmit,
}: {
  initial: PartnerFormValues;
  submitLabel: string;
  onSubmit: (values: PartnerFormValues) => void | Promise<void>;
  showStateRegistration?: boolean;
  formId?: string;
  hideSubmit?: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [cepHint, setCepHint] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);

  const set = useCallback(<K extends keyof PartnerFormValues>(key: K, value: PartnerFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const lookupCep = useCallback(async () => {
    setCepHint(null);
    setCepLoading(true);
    try {
      const data = await fetchAddressByCep(form.zipCode);
      if (!data) {
        setCepHint('CEP não encontrado.');
        return;
      }
      setForm((prev) => ({
        ...prev,
        zipCode: formatCep(data.cep),
        street: data.logradouro || prev.street,
        district: data.bairro || prev.district,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
        addressComplement: prev.addressComplement || data.complemento || '',
      }));
      setCepHint('Endereço preenchido pelo CEP.');
    } catch {
      setCepHint('Falha ao consultar CEP.');
    } finally {
      setCepLoading(false);
    }
  }, [form.zipCode]);

  function onCepKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab' && !e.shiftKey) {
      void lookupCep();
    }
  }

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(form);
      }}
    >
      <Field label="Tipo de pessoa">
        <select
          className={inputClass}
          value={form.personType}
          onChange={(e) => set('personType', e.target.value as 'PF' | 'PJ')}
        >
          <option value="PJ">Pessoa jurídica (CNPJ)</option>
          <option value="PF">Pessoa física (CPF)</option>
        </select>
      </Field>

      <Field label={form.personType === 'PJ' ? 'Razão social' : 'Nome completo'}>
        <input
          className={inputClass}
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </Field>

      {form.personType === 'PJ' ? (
        <Field label="Nome fantasia">
          <input className={inputClass} value={form.tradeName} onChange={(e) => set('tradeName', e.target.value)} />
        </Field>
      ) : null}

      {form.personType === 'PF' ? (
        <Field label="CPF">
          <input
            className={inputClass}
            value={form.cpf}
            onChange={(e) => set('cpf', e.target.value)}
            placeholder="000.000.000-00"
          />
        </Field>
      ) : (
        <Field label="CNPJ">
          <input
            className={inputClass}
            value={form.cnpj}
            onChange={(e) => set('cnpj', e.target.value)}
            placeholder="00.000.000/0000-00"
          />
        </Field>
      )}

      {showStateRegistration && form.personType === 'PJ' ? (
        <Field label="Inscrição estadual (IE)">
          <input
            className={inputClass}
            value={form.stateRegistration}
            onChange={(e) => set('stateRegistration', e.target.value)}
          />
        </Field>
      ) : null}

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-x-3">
        <Field label="E-mail">
          <input
            type="email"
            className={inputClass}
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </Field>
        <Field label="Telefone">
          <input className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Celular">
          <input className={inputClass} value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
        </Field>
      </div>

      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Endereço</p>

      <Field label="CEP (Tab busca rua)">
        <input
          className={inputClass}
          value={form.zipCode}
          onChange={(e) => set('zipCode', formatCep(e.target.value))}
          onKeyDown={onCepKeyDown}
          placeholder="00000-000"
        />
        {cepLoading ? <span className="text-xs text-slate-500">Consultando CEP…</span> : null}
        {cepHint ? <span className="text-xs text-emerald-700">{cepHint}</span> : null}
      </Field>

      <Field label="Logradouro">
        <input className={inputClass} value={form.street} onChange={(e) => set('street', e.target.value)} />
      </Field>

      <div className="grid gap-0 sm:grid-cols-3 sm:gap-x-3">
        <Field label="Número">
          <input className={inputClass} value={form.addressNumber} onChange={(e) => set('addressNumber', e.target.value)} />
        </Field>
        <Field label="Complemento">
          <input
            className={inputClass}
            value={form.addressComplement}
            onChange={(e) => set('addressComplement', e.target.value)}
          />
        </Field>
        <Field label="Bairro">
          <input className={inputClass} value={form.district} onChange={(e) => set('district', e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-x-3">
        <Field label="Cidade">
          <input className={inputClass} value={form.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field label="UF">
          <input
            className={inputClass}
            maxLength={2}
            value={form.state}
            onChange={(e) => set('state', e.target.value.toUpperCase())}
          />
        </Field>
      </div>

      {hideSubmit ? null : <SubmitButton label={submitLabel} />}
    </form>
  );
}

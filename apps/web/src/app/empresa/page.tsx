'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { PageIntro } from '@/components/crud';
import { ErrorBox, Field, PageCard, SubmitButton, inputClass } from '@/components/ui-parts';
import { useCompanyLogoUrl } from '@/hooks/use-company-logo-url';
import { apiFetch, apiUpload } from '@/lib/api';
import { errorMessage } from '@/lib/labels';

type Company = {
  id: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string;
  stateReg: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
};

export default function EmpresaPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [logoFilePreview, setLogoFilePreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const serverLogoUrl = useCompanyLogoUrl(company?.logoUrl);
  const logoPreview = logoFilePreview ?? serverLogoUrl;
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoOk, setLogoOk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    void apiFetch<Company>('/v1/cadastros/company').then(setCompany);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!logoFile) {
      setLogoFilePreview(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    const body = {
      legalName: String(fd.get('legalName') ?? '').trim(),
      tradeName: String(fd.get('tradeName') ?? '').trim() || null,
      cnpj: String(fd.get('cnpj') ?? '').trim(),
      stateReg: String(fd.get('stateReg') ?? '').trim() || null,
      address: String(fd.get('address') ?? '').trim() || null,
      city: String(fd.get('city') ?? '').trim() || null,
      state: String(fd.get('state') ?? '').trim().toUpperCase() || null,
      zipCode: String(fd.get('zipCode') ?? '').trim() || null,
      phone: String(fd.get('phone') ?? '').trim() || null,
      email: String(fd.get('email') ?? '').trim() || null,
    };
    try {
      const updated = await apiFetch<Company>('/v1/cadastros/company', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setCompany(updated);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function uploadLogo() {
    setLogoError(null);
    setLogoOk(false);
    if (!logoFile) {
      setLogoError('Selecione um arquivo de imagem antes de enviar.');
      return;
    }
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', logoFile);
      const updated = await apiUpload<Company>('/v1/cadastros/company/logo', fd);
      setCompany(updated);
      setLogoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setLogoOk(true);
    } catch (err) {
      setLogoError(errorMessage(err));
    } finally {
      setLogoUploading(false);
    }
  }

  if (!company) {
    return (
      <AdminShell title="Empresa">
        <p className="text-sm text-slate-500">Carregando…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Empresa">
      <PageIntro
        title="Cadastro da empresa"
        description="Dados da razão social, endereço e logo usados em relatórios e documentos."
      />
      <ErrorBox message={error} />

      <PageCard title="Identidade visual">
        <ErrorBox message={logoError} />
        {logoOk ? <p className="mb-3 text-sm text-emerald-700">Logo enviado ao servidor.</p> : null}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div
            className="flex h-40 w-40 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-2"
            aria-hidden
          >
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo da empresa" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-center text-xs text-slate-400">Sem logo</span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <Field label="Arquivo do logo">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm`}
                onChange={(e) => {
                  setLogoOk(false);
                  setLogoError(null);
                  const f = e.target.files?.[0] ?? null;
                  setLogoFile(f);
                }}
              />
            </Field>
            <p className="text-xs text-slate-500">PNG, JPG, WebP ou SVG · máximo 2 MB</p>
            <Button
              type="button"
              variant="secondary"
              disabled={logoUploading || !logoFile}
              onClick={() => void uploadLogo()}
            >
              {logoUploading ? 'Enviando…' : 'Enviar logo para o servidor'}
            </Button>
          </div>
        </div>
      </PageCard>

      <form onSubmit={save}>
        <PageCard title="Identificação">
          <div className="grid gap-1 md:grid-cols-2 md:gap-x-6">
            <Field label="Razão social">
              <input name="legalName" className={inputClass} required defaultValue={company.legalName} />
            </Field>
            <Field label="Nome fantasia">
              <input name="tradeName" className={inputClass} defaultValue={company.tradeName ?? ''} />
            </Field>
            <Field label="CNPJ">
              <input
                name="cnpj"
                className={inputClass}
                required
                inputMode="numeric"
                defaultValue={company.cnpj}
              />
            </Field>
            <Field label="Inscrição estadual">
              <input name="stateReg" className={inputClass} defaultValue={company.stateReg ?? ''} />
            </Field>
          </div>
        </PageCard>

        <PageCard title="Endereço">
          <div className="grid gap-1 md:grid-cols-2 md:gap-x-6">
            <div className="md:col-span-2">
              <Field label="Logradouro / endereço">
                <input name="address" className={inputClass} defaultValue={company.address ?? ''} />
              </Field>
            </div>
            <Field label="Cidade">
              <input name="city" className={inputClass} defaultValue={company.city ?? ''} />
            </Field>
            <Field label="UF">
              <input
                name="state"
                className={inputClass}
                maxLength={2}
                placeholder="SP"
                defaultValue={company.state ?? ''}
              />
            </Field>
            <Field label="CEP">
              <input name="zipCode" className={inputClass} inputMode="numeric" defaultValue={company.zipCode ?? ''} />
            </Field>
          </div>
        </PageCard>

        <PageCard title="Contato">
          <div className="grid gap-1 md:grid-cols-2 md:gap-x-6">
            <Field label="Telefone">
              <input name="phone" type="tel" className={inputClass} defaultValue={company.phone ?? ''} />
            </Field>
            <Field label="E-mail">
              <input name="email" type="email" className={inputClass} defaultValue={company.email ?? ''} />
            </Field>
          </div>
        </PageCard>

        {saved ? <p className="mb-4 text-sm text-emerald-700">Dados cadastrais salvos.</p> : null}
        <SubmitButton label="Salvar dados da empresa" />
      </form>
    </AdminShell>
  );
}

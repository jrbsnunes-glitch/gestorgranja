'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { PageIntro } from '@/components/crud';
import { ErrorBox, Field, PageCard, SubmitButton, inputClass } from '@/components/ui-parts';
import { apiFetch, apiUpload } from '@/lib/api';
import { errorMessage } from '@/lib/labels';

type IssuerSettings = {
  sefazEnvironment: 'homologacao' | 'producao';
  nfceCscId: string | null;
  nfceCsc: string | null;
  series: number;
  nfceSeries: number;
  lastNfeNumber: number;
  lastNfceNumber: number;
  certificateExpiresAt: string | null;
  hasCertificate: boolean;
  hasCertificatePassword: boolean;
  respTecCnpj: string | null;
  respTecContact: string | null;
  respTecEmail: string | null;
  respTecPhone: string | null;
  respTecCsrtId: string | null;
  hasRespTecCsrt: boolean;
};

const EMPTY_ISSUER_SETTINGS: IssuerSettings = {
  sefazEnvironment: 'homologacao',
  nfceCscId: null,
  nfceCsc: null,
  series: 1,
  nfceSeries: 1,
  lastNfeNumber: 0,
  lastNfceNumber: 0,
  certificateExpiresAt: null,
  hasCertificate: false,
  hasCertificatePassword: false,
  respTecCnpj: null,
  respTecContact: null,
  respTecEmail: null,
  respTecPhone: null,
  respTecCsrtId: null,
  hasRespTecCsrt: false,
};

export default function EmpresaFiscalPage() {
  const [settings, setSettings] = useState<IssuerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');
  const [testOut, setTestOut] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    void apiFetch<IssuerSettings | null>('/v1/fiscal/issuer-settings')
      .then((s) => setSettings(s ?? EMPTY_ISSUER_SETTINGS))
      .catch((err) => {
        setSettings(null);
        setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/v1/fiscal/issuer-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          sefazEnvironment: fd.get('sefazEnvironment'),
          nfceCscId: String(fd.get('nfceCscId') || '') || undefined,
          nfceCsc: String(fd.get('nfceCsc') || '') || undefined,
          series: Number(fd.get('series')),
          nfceSeries: Number(fd.get('nfceSeries')),
          certificatePassword: String(fd.get('certificatePassword') || '') || undefined,
          respTecCnpj: String(fd.get('respTecCnpj') || '') || undefined,
          respTecContact: String(fd.get('respTecContact') || '') || undefined,
          respTecEmail: String(fd.get('respTecEmail') || '') || undefined,
          respTecPhone: String(fd.get('respTecPhone') || '') || undefined,
          respTecCsrtId: String(fd.get('respTecCsrtId') || '') || undefined,
          respTecCsrt: String(fd.get('respTecCsrt') || '') || undefined,
        }),
      });
      setOk('Configurações salvas.');
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function uploadCert() {
    setError(null);
    setOk(null);
    if (!certFile) {
      setError('Selecione o arquivo .pfx');
      return;
    }
    if (!certPassword) {
      setError('Informe a senha do certificado');
      return;
    }
    const fd = new FormData();
    fd.append('file', certFile);
    fd.append('password', certPassword);
    try {
      await apiUpload('/v1/fiscal/certificate', fd);
      setOk('Certificado enviado.');
      setCertFile(null);
      setCertPassword('');
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function testSefaz() {
    setError(null);
    setTestOut(null);
    setTestBusy(true);
    try {
      const r = await apiFetch<{ ok: boolean; cStat?: string; message?: string; raw?: string }>(
        '/v1/fiscal/test-sefaz',
        { method: 'POST', body: '{}' },
      );
      setTestOut(
        [
          r.ok ? 'SEFAZ operacional' : 'SEFAZ respondeu com alerta',
          r.cStat ? `cStat: ${r.cStat}` : null,
          r.message ?? null,
          r.raw ? `\n--- resposta (trecho) ---\n${r.raw}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <AdminShell title="Emissor fiscal">
      <PageIntro
        title="Emissor fiscal (NF-e / NFC-e)"
        description="Certificado A1, ambiente SEFAZ (AM) e numeração. Use homologação antes de produção."
      />
      <p className="mb-4 text-sm">
        <Link href="/empresa" className="text-emerald-800 underline">
          ← Dados da empresa
        </Link>
        {' · '}
        <Link href="/vendas/documentos-fiscais" className="text-emerald-800 underline">
          Documentos emitidos
        </Link>
      </p>
      <ErrorBox message={error} />
      {ok ? <p className="mb-3 text-sm text-emerald-700">{ok}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : !settings ? (
        <p className="text-sm text-red-700">Não foi possível carregar as configurações fiscais.</p>
      ) : (
        <>
          <PageCard title="Ambiente e NFC-e">
            <form id="fiscal-issuer-form" onSubmit={saveSettings} className="max-w-lg space-y-3">
              <Field label="Ambiente SEFAZ">
                <select
                  name="sefazEnvironment"
                  className={inputClass}
                  defaultValue={settings.sefazEnvironment}
                >
                  <option value="homologacao">Homologação</option>
                  <option value="producao">Produção</option>
                </select>
              </Field>
              <Field label="Série NF-e">
                <input name="series" type="number" min={1} className={inputClass} defaultValue={settings.series} />
              </Field>
              <Field label="Série NFC-e">
                <input
                  name="nfceSeries"
                  type="number"
                  min={1}
                  className={inputClass}
                  defaultValue={settings.nfceSeries}
                />
              </Field>
              <Field label="ID CSC (NFC-e)">
                <input name="nfceCscId" className={inputClass} defaultValue={settings.nfceCscId ?? ''} />
              </Field>
              <Field label="CSC (NFC-e)">
                <input name="nfceCsc" className={inputClass} defaultValue={settings.nfceCsc ?? ''} />
              </Field>
              <Field label="Senha do certificado (atualizar)">
                <input name="certificatePassword" type="password" className={inputClass} autoComplete="off" />
              </Field>
              <p className="text-xs text-slate-500">
                Última NF-e: {settings.lastNfeNumber} · Última NFC-e: {settings.lastNfceNumber}
                {settings.certificateExpiresAt
                  ? ` · Certificado válido até ${new Date(settings.certificateExpiresAt).toLocaleDateString('pt-BR')}`
                  : settings.hasCertificate
                    ? ''
                    : ' · Certificado não enviado'}
              </p>
              <SubmitButton>Salvar</SubmitButton>
            </form>
          </PageCard>

          <PageCard title="Responsável técnico (NT 2018.005)">
            <p className="mb-3 text-sm text-slate-600">
              Obrigatório na NF-e/NFC-e AM (rejeição <strong>972</strong> sem estes dados). Informe o{' '}
              <strong>CNPJ do desenvolvedor</strong> do sistema, contato, e-mail e telefone (DDD + número). O CSRT
              é obtido na SEFAZ quando exigido (rejeições 975–978).
            </p>
            <div className="max-w-lg space-y-3">
              <Field label="CNPJ responsável técnico">
                <input
                  name="respTecCnpj"
                  form="fiscal-issuer-form"
                  className={inputClass}
                  defaultValue={settings.respTecCnpj ?? ''}
                  placeholder="Somente dígitos"
                />
              </Field>
              <Field label="Nome contato (xContato)">
                <input
                  name="respTecContact"
                  form="fiscal-issuer-form"
                  className={inputClass}
                  defaultValue={settings.respTecContact ?? ''}
                />
              </Field>
              <Field label="E-mail">
                <input
                  name="respTecEmail"
                  form="fiscal-issuer-form"
                  type="email"
                  className={inputClass}
                  defaultValue={settings.respTecEmail ?? ''}
                />
              </Field>
              <Field label="Telefone (DDD + número)">
                <input
                  name="respTecPhone"
                  form="fiscal-issuer-form"
                  className={inputClass}
                  defaultValue={settings.respTecPhone ?? ''}
                />
              </Field>
              <Field label="ID CSRT (opcional)">
                <input
                  name="respTecCsrtId"
                  form="fiscal-issuer-form"
                  className={inputClass}
                  defaultValue={settings.respTecCsrtId ?? ''}
                  placeholder="Ex.: 01"
                />
              </Field>
              <Field label="CSRT (opcional — deixe vazio para manter)">
                <input
                  name="respTecCsrt"
                  form="fiscal-issuer-form"
                  type="password"
                  className={inputClass}
                  autoComplete="off"
                  placeholder={settings.hasRespTecCsrt ? '•••••• (cadastrado)' : ''}
                />
              </Field>
            </div>
          </PageCard>

          <PageCard title="Certificado A1 (.pfx)" className="mt-6">
            <p className="mb-3 text-sm text-slate-600">
              Status: {settings.hasCertificate ? 'certificado no servidor' : 'pendente'} · Senha:{' '}
              {settings.hasCertificatePassword ? 'configurada' : 'pendente'}
            </p>
            <div className="flex max-w-lg flex-col gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".pfx,.p12"
                onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
              />
              <input
                type="password"
                placeholder="Senha do certificado"
                className={inputClass}
                value={certPassword}
                onChange={(e) => setCertPassword(e.target.value)}
                autoComplete="off"
              />
              <Button type="button" onClick={() => void uploadCert()}>
                Enviar certificado
              </Button>
            </div>
          </PageCard>

          <PageCard title="Teste SEFAZ" className="mt-6">
            <Button type="button" variant="secondary" disabled={testBusy} onClick={() => void testSefaz()}>
              {testBusy ? 'Consultando SEFAZ…' : 'Consultar status do serviço (AM)'}
            </Button>
            {testOut ? (
              <pre className="mt-3 max-h-40 overflow-auto rounded bg-slate-100 p-2 text-xs">{testOut}</pre>
            ) : null}
          </PageCard>
        </>
      )}
    </AdminShell>
  );
}

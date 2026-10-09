'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { PageIntro } from '@/components/crud';
import { ErrorBox, Field, PageCard, SubmitButton, inputClass } from '@/components/ui-parts';
import { apiFetch, apiUpload } from '@/lib/api';
import { errorMessage } from '@/lib/labels';

type SicoobSettings = {
  environment: 'sandbox' | 'production';
  clientId: string | null;
  numeroCliente: number | null;
  numeroContaCorrente: string | null;
  codigoModalidade: number;
  codigoEspecieDocumento: string;
  identificacaoEmissaoBoleto: number;
  identificacaoDistribuicaoBoleto: number;
  codigoCadastrarPIX: number;
  dueDaysDefault: number;
  tipoMulta: number;
  tipoJurosMora: number;
  valorMulta: number | null;
  valorJurosMora: number | null;
  diasInicioMultaAposVencimento: number;
  diasInicioJurosAposVencimento: number;
  diasLimitePagamentoAposVencimento: number | null;
  encargosNasInstrucoes: boolean;
  useFiscalCertificate: boolean;
  hasCertificate: boolean;
  hasCertificatePassword: boolean;
  hasSandboxToken: boolean;
};

function parseOptionalAmount(raw: FormDataEntryValue | null): number | null {
  const t = String(raw ?? '').trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseOptionalInt(raw: FormDataEntryValue | null): number | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

const EMPTY: SicoobSettings = {
  environment: 'sandbox',
  clientId: null,
  numeroCliente: null,
  numeroContaCorrente: null,
  codigoModalidade: 1,
  codigoEspecieDocumento: 'DM',
  identificacaoEmissaoBoleto: 1,
  identificacaoDistribuicaoBoleto: 1,
  codigoCadastrarPIX: 0,
  dueDaysDefault: 7,
  tipoMulta: 0,
  tipoJurosMora: 3,
  valorMulta: null,
  valorJurosMora: null,
  diasInicioMultaAposVencimento: 1,
  diasInicioJurosAposVencimento: 1,
  diasLimitePagamentoAposVencimento: null,
  encargosNasInstrucoes: true,
  useFiscalCertificate: true,
  hasCertificate: false,
  hasCertificatePassword: false,
  hasSandboxToken: false,
};

export default function EmpresaBoletosPage() {
  const [settings, setSettings] = useState<SicoobSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    void apiFetch<SicoobSettings>('/v1/finance/sicoob/settings')
      .then((s) => setSettings(s ?? EMPTY))
      .catch((err) => {
        setSettings(EMPTY);
        setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const fd = new FormData(e.currentTarget);
    try {
      const updated = await apiFetch<SicoobSettings>('/v1/finance/sicoob/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          environment: fd.get('environment'),
          clientId: String(fd.get('clientId') || '').trim() || null,
          numeroCliente: fd.get('numeroCliente') ? Number(fd.get('numeroCliente')) : null,
          numeroContaCorrente: String(fd.get('numeroContaCorrente') || '').trim() || null,
          codigoModalidade: Number(fd.get('codigoModalidade') || 1),
          codigoEspecieDocumento: String(fd.get('codigoEspecieDocumento') || 'DM'),
          identificacaoEmissaoBoleto: Number(fd.get('identificacaoEmissaoBoleto') || 1),
          identificacaoDistribuicaoBoleto: Number(fd.get('identificacaoDistribuicaoBoleto') || 1),
          codigoCadastrarPIX: Number(fd.get('codigoCadastrarPIX') || 0),
          dueDaysDefault: Number(fd.get('dueDaysDefault') || 7),
          tipoMulta: Number(fd.get('tipoMulta') ?? 0),
          tipoJurosMora: Number(fd.get('tipoJurosMora') ?? 3),
          valorMulta: parseOptionalAmount(fd.get('valorMulta')),
          valorJurosMora: parseOptionalAmount(fd.get('valorJurosMora')),
          diasInicioMultaAposVencimento: Number(fd.get('diasInicioMultaAposVencimento') || 1),
          diasInicioJurosAposVencimento: Number(fd.get('diasInicioJurosAposVencimento') || 1),
          diasLimitePagamentoAposVencimento: parseOptionalInt(fd.get('diasLimitePagamentoAposVencimento')),
          encargosNasInstrucoes: fd.get('encargosNasInstrucoes') === 'on',
          useFiscalCertificate: fd.get('useFiscalCertificate') === 'on',
          sandboxAccessToken: String(fd.get('sandboxAccessToken') || ''),
        }),
      });
      setSettings(updated);
      setOk('Configuração salva.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  async function uploadCert() {
    if (!certFile) {
      setError('Selecione o arquivo .pfx');
      return;
    }
    setError(null);
    setOk(null);
    const fd = new FormData();
    fd.append('file', certFile);
    fd.append('password', certPassword);
    try {
      const updated = await apiUpload<SicoobSettings>('/v1/finance/sicoob/certificate', fd);
      setSettings(updated);
      setCertFile(null);
      setCertPassword('');
      if (fileRef.current) fileRef.current.value = '';
      setOk('Certificado enviado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no certificado');
    }
  }

  const s = settings ?? EMPTY;

  return (
    <AdminShell title="Boletos Sicoob">
      <PageIntro
        title="Cobrança bancária Sicoob (API V3)"
        description="Credenciais do Portal Developers, número do cliente Sisbr e certificado ICP-Brasil (mTLS). Sem esses dados o sistema monta o boleto, mas o banco não registra o título."
      />
      <ErrorBox message={error} />
      {ok ? <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{ok}</p> : null}

      <PageCard title="Aplicativo e contrato">
        {loading ? (
          <p className="text-sm text-slate-600">Carregando…</p>
        ) : (
          <form onSubmit={save} className="space-y-3">
            <Field label="Ambiente">
              <select name="environment" className={inputClass} defaultValue={s.environment}>
                <option value="sandbox">Sandbox (token estático, sem mTLS)</option>
                <option value="production">Produção (OAuth + certificado)</option>
              </select>
            </Field>
            <Field label="client_id (Portal Developers)">
              <input name="clientId" className={inputClass} defaultValue={s.clientId ?? ''} autoComplete="off" />
            </Field>
            <Field label="Número do cliente (Sisbr)">
              <input name="numeroCliente" type="number" className={inputClass} defaultValue={s.numeroCliente ?? ''} />
            </Field>
            <Field label="Conta corrente de crédito">
              <input name="numeroContaCorrente" className={inputClass} defaultValue={s.numeroContaCorrente ?? ''} />
            </Field>
            <Field label="Modalidade">
              <select name="codigoModalidade" className={inputClass} defaultValue={s.codigoModalidade}>
                <option value={1}>1 — Simples com registro</option>
                <option value={3}>3 — Caucionada</option>
                <option value={5}>5 — Carnê</option>
                <option value={8}>8 — Conta capital</option>
              </select>
            </Field>
            <Field label="Espécie do documento">
              <input name="codigoEspecieDocumento" className={inputClass} defaultValue={s.codigoEspecieDocumento} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Quem emite">
                <select name="identificacaoEmissaoBoleto" className={inputClass} defaultValue={s.identificacaoEmissaoBoleto}>
                  <option value={1}>Banco emite</option>
                  <option value={2}>Cliente emite</option>
                </select>
              </Field>
              <Field label="Quem distribui">
                <select
                  name="identificacaoDistribuicaoBoleto"
                  className={inputClass}
                  defaultValue={s.identificacaoDistribuicaoBoleto}
                >
                  <option value={1}>Banco distribui</option>
                  <option value={2}>Cliente distribui</option>
                </select>
              </Field>
            </div>
            <p className="text-sm text-slate-600">
              Com <strong>Cliente emite</strong> e <strong>Cliente distribui</strong>, o GestorGranja imprime a{' '}
              <strong>ficha de compensação</strong> no padrão FEBRABAN/Sicoob (756), com linha digitável, código de barras,
              QR Pix quando houver, logo da empresa e recibo do pagador. Confirme no Sisbr se o contrato permite essa modalidade.
            </p>
            <Field label="Pix no boleto">
              <select name="codigoCadastrarPIX" className={inputClass} defaultValue={s.codigoCadastrarPIX}>
                <option value={0}>Padrão do cadastro no Sisbr</option>
                <option value={1}>Com Pix</option>
                <option value={2}>Sem Pix</option>
              </select>
            </Field>
            <Field label="Prazo padrão (dias) para boleto de venda/PDV">
              <input name="dueDaysDefault" type="number" min={0} className={inputClass} defaultValue={s.dueDaysDefault} />
            </Field>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Multa, juros e pagamento após o vencimento</h3>
              <p className="mb-3 text-sm text-slate-600">
                Valores enviados ao Sicoob na emissão (API V3). O banco calcula o título atualizado na liquidação em
                atraso. Deixe o limite em branco para usar 90 dias após o vencimento quando houver multa ou juros.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Multa">
                  <select name="tipoMulta" className={inputClass} defaultValue={s.tipoMulta}>
                    <option value={0}>0 — Isenta</option>
                    <option value={1}>1 — Valor fixo (R$)</option>
                    <option value={2}>2 — Percentual (%)</option>
                  </select>
                </Field>
                <Field label="Valor da multa">
                  <input
                    name="valorMulta"
                    className={inputClass}
                    inputMode="decimal"
                    placeholder={s.tipoMulta === 0 ? '—' : 'Ex.: 2 ou 10,00'}
                    defaultValue={s.valorMulta ?? ''}
                  />
                </Field>
                <Field label="Juros de mora">
                  <select name="tipoJurosMora" className={inputClass} defaultValue={s.tipoJurosMora}>
                    <option value={3}>3 — Isento</option>
                    <option value={1}>1 — Valor por dia (R$)</option>
                    <option value={2}>2 — Taxa mensal (%)</option>
                  </select>
                </Field>
                <Field label="Valor dos juros">
                  <input
                    name="valorJurosMora"
                    className={inputClass}
                    inputMode="decimal"
                    placeholder={s.tipoJurosMora === 3 ? '—' : 'Ex.: 0,33 ou 2'}
                    defaultValue={s.valorJurosMora ?? ''}
                  />
                </Field>
                <Field label="Multa a partir de (dias após venc.)">
                  <input
                    name="diasInicioMultaAposVencimento"
                    type="number"
                    min={1}
                    className={inputClass}
                    defaultValue={s.diasInicioMultaAposVencimento}
                  />
                </Field>
                <Field label="Juros a partir de (dias após venc.)">
                  <input
                    name="diasInicioJurosAposVencimento"
                    type="number"
                    min={1}
                    className={inputClass}
                    defaultValue={s.diasInicioJurosAposVencimento}
                  />
                </Field>
                <Field label="Limite para pagamento (dias após venc.)">
                  <input
                    name="diasLimitePagamentoAposVencimento"
                    type="number"
                    min={0}
                    className={inputClass}
                    placeholder="Automático (90) se multa/juros"
                    defaultValue={s.diasLimitePagamentoAposVencimento ?? ''}
                  />
                </Field>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-800">
                <input name="encargosNasInstrucoes" type="checkbox" defaultChecked={s.encargosNasInstrucoes} />
                Incluir resumo de multa/juros/limite nas instruções do boleto (até 5 linhas de 40 caracteres)
              </label>
            </div>

            <Field label="Token sandbox (só sandbox; deixe em branco para não alterar)">
              <input
                name="sandboxAccessToken"
                className={inputClass}
                type="password"
                autoComplete="off"
                placeholder={s.hasSandboxToken ? 'Token já gravado' : ''}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input name="useFiscalCertificate" type="checkbox" defaultChecked={s.useFiscalCertificate} />
              Usar o certificado A1 fiscal (mesmo CNPJ do cooperado) no mTLS
            </label>
            <SubmitButton label="Salvar configuração" />
          </form>
        )}
      </PageCard>

      <PageCard title="Certificado próprio (opcional)">
        <p className="mb-3 text-sm text-slate-600">
          Produção exige PFX ICP-Brasil. Se não usar o A1 fiscal, envie um certificado do cooperado.
        </p>
        <Field label="Arquivo .pfx">
          <input
            ref={fileRef}
            type="file"
            accept=".pfx,.p12"
            onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        <Field label="Senha">
          <input
            type="password"
            className={inputClass}
            value={certPassword}
            onChange={(e) => setCertPassword(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Button type="button" onClick={() => void uploadCert()}>
          Enviar certificado
        </Button>
      </PageCard>
    </AdminShell>
  );
}

'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FormCadastroModal } from '@/components/crud/form-cadastro-modal';
import { PartnerLookupField } from '@/components/partner-lookup-field';
import { OperationNatureLookupField } from '@/components/operation-nature-lookup-field';
import { ProductLookupField } from '@/components/product-lookup-field';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { errorMessage } from '@/lib/labels';

type DestMode = 'registered' | 'manual';

const DEFAULT_OPERATION_NATURE_ID = 'f1a10001-0000-4000-8000-000000000001';
const DEFAULT_FISCAL_SITUATION_ID = 'f1a20001-0000-4000-8000-000000000001';

type FiscalSituationOption = { id: string; code: string; description: string; ncm?: string | null };

type ItemLine = {
  key: string;
  mode: 'catalog' | 'manual';
  productId: string;
  operationNatureId: string;
  description: string;
  fiscalSituationId: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discount: string;
};

type PreviewResult = {
  html: string;
  accessKey: string;
  series: number;
  number: number;
  total: number;
  partnerName: string;
};

type DraftLoad = {
  documentId: string;
  partnerId: string;
  items: Array<{
    mode: 'catalog' | 'manual';
    productId?: string;
    operationNatureId?: string;
    description?: string;
    fiscalSituationId?: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
    discount: number;
  }>;
};

function newLine(): ItemLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mode: 'catalog',
    productId: '',
    operationNatureId: DEFAULT_OPERATION_NATURE_ID,
    description: '',
    fiscalSituationId: DEFAULT_FISCAL_SITUATION_ID,
    unit: 'UN',
    quantity: '1',
    unitPrice: '',
    discount: '0',
  };
}

function initialFormState() {
  return {
    destMode: 'registered' as DestMode,
    partnerId: '',
    lines: [newLine()],
  };
}

export function ManualNfeModal({
  open,
  onClose,
  onSuccess,
  documentId = null,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  documentId?: string | null;
}) {
  const isEdit = !!documentId;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [destMode, setDestMode] = useState<DestMode>('registered');
  const [partnerId, setPartnerId] = useState('');
  const [lines, setLines] = useState<ItemLine[]>([newLine()]);
  const [fiscalSituations, setFiscalSituations] = useState<FiscalSituationOption[]>([]);

  useEffect(() => {
    if (!open) return;
    void apiFetch<FiscalSituationOption[]>('/v1/cadastros/general/fiscal-situations?activeOnly=1').then(
      setFiscalSituations,
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const s = initialFormState();
    setError(null);
    setBusy(false);
    setStep('form');
    setPreview(null);
    setDestMode(s.destMode);
    setPartnerId(s.partnerId);
    setLines(s.lines);

    if (!documentId) return;

    let cancelled = false;
    setLoadingDraft(true);
    void apiFetch<DraftLoad>(`/v1/fiscal/documents/${documentId}/manual-nfe`)
      .then((draft) => {
        if (cancelled) return;
        setPartnerId(draft.partnerId);
        setDestMode('registered');
        setLines(
          draft.items.map((it) => ({
            key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            mode: it.mode,
            productId: it.productId ?? '',
            operationNatureId: it.operationNatureId ?? DEFAULT_OPERATION_NATURE_ID,
            description: it.description ?? '',
            fiscalSituationId: it.fiscalSituationId ?? DEFAULT_FISCAL_SITUATION_ID,
            unit: it.unit ?? 'UN',
            quantity: String(it.quantity),
            unitPrice: String(it.unitPrice),
            discount: String(it.discount),
          })),
        );
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingDraft(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, documentId]);

  const updateLine = useCallback((key: string, patch: Partial<ItemLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }, []);

  const addLine = () => setLines((prev) => [...prev, newLine()]);
  const removeLine = (key: string) => setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));

  function buildPayload(fd: FormData) {
    const partnerManual =
      destMode === 'manual'
        ? {
            personType: String(fd.get('personType') || 'PJ') as 'PF' | 'PJ',
            name: String(fd.get('destName') || '').trim(),
            cpf: String(fd.get('cpf') || '').trim() || undefined,
            cnpj: String(fd.get('cnpj') || '').trim() || undefined,
            stateRegistration: String(fd.get('stateRegistration') || '').trim() || undefined,
            email: String(fd.get('email') || '').trim() || undefined,
            phone: String(fd.get('phone') || '').trim() || undefined,
            zipCode: String(fd.get('zipCode') || '').trim() || undefined,
            street: String(fd.get('street') || '').trim() || undefined,
            addressNumber: String(fd.get('addressNumber') || '').trim() || undefined,
            district: String(fd.get('district') || '').trim() || undefined,
            city: String(fd.get('city') || '').trim() || undefined,
            state: String(fd.get('state') || '').trim() || undefined,
          }
        : undefined;

    const items = lines.map((line) => {
      const quantity = Number(line.quantity);
      const unitPrice = Number(String(line.unitPrice).replace(',', '.'));
      const discount = Number(String(line.discount).replace(',', '.')) || 0;
      const operationNatureId = line.operationNatureId || DEFAULT_OPERATION_NATURE_ID;
      if (line.mode === 'catalog' && line.productId) {
        return { productId: line.productId, operationNatureId, quantity, unitPrice, discount };
      }
      return {
        description: line.description.trim(),
        fiscalSituationId: line.fiscalSituationId || DEFAULT_FISCAL_SITUATION_ID,
        operationNatureId,
        unit: line.unit.trim() || 'UN',
        quantity,
        unitPrice,
        discount,
      };
    });

    return {
      partnerId: destMode === 'registered' ? partnerId || undefined : undefined,
      partner: partnerManual,
      items,
    };
  }

  function validateBeforeApi() {
    if (destMode === 'registered' && !partnerId) {
      setError('Selecione o cliente destinatário.');
      return false;
    }
    for (const line of lines) {
      if (line.mode === 'catalog' && !line.productId) {
        setError('Selecione o produto em cada item do estoque ou use item avulso.');
        return false;
      }
      if (!line.operationNatureId) {
        setError(`Item ${lines.indexOf(line) + 1}: selecione a natureza da operação (CFOP).`);
        return false;
      }
      if (line.mode === 'manual' && !line.fiscalSituationId) {
        setError(`Item ${lines.indexOf(line) + 1}: selecione a situação fiscal (NCM/CST).`);
        return false;
      }
    }
    setError(null);
    return true;
  }

  async function runPreview(payload: ReturnType<typeof buildPayload>) {
    const result = await apiFetch<PreviewResult>('/v1/fiscal/manual-nfe/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setPreview(result);
    setStep('preview');
  }

  async function onPreview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateBeforeApi()) return;
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const payload = buildPayload(fd);
    try {
      await runPreview(payload);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!documentId || !validateBeforeApi()) return;
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = buildPayload(fd);
    try {
      await apiFetch(`/v1/fiscal/documents/${documentId}/manual-nfe`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await runPreview(payload);
      onSuccess();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onFormSubmit(e: FormEvent<HTMLFormElement>) {
    if (isEdit) await onSaveEdit(e);
    else await onPreview(e);
  }

  async function confirmSave() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    const form = document.getElementById('manual-nfe-form') as HTMLFormElement | null;
    if (!form) return;
    const fd = new FormData(form);
    try {
      await apiFetch('/v1/fiscal/manual-nfe', {
        method: 'POST',
        body: JSON.stringify({ ...buildPayload(fd), emitNow: false }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const footer =
    step === 'form' ? (
      <>
        <Button type="submit" form="manual-nfe-form" disabled={busy || loadingDraft}>
          {busy ? (isEdit ? 'Gravando…' : 'Gerando…') : isEdit ? 'Gravar' : 'Pré-visualização'}
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
      </>
    ) : isEdit ? (
      <>
        <Button
          type="button"
          disabled={busy}
          onClick={() => {
            onSuccess();
            onClose();
          }}
        >
          Fechar
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => setStep('form')}>
          Voltar e editar
        </Button>
      </>
    ) : (
      <>
        <Button type="button" disabled={busy} onClick={() => void confirmSave()}>
          {busy ? 'Gravando…' : 'Confirmar e gravar rascunho'}
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => setStep('form')}>
          Voltar e editar
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
      </>
    );

  return (
    <FormCadastroModal
      open={open}
      onClose={onClose}
      size="xl"
      dense
      title={
        step === 'form'
          ? isEdit
            ? 'Editar NF-e manual'
            : 'Incluir NF-e manual'
          : 'Pré-visualização da NF-e'
      }
      hint={
        step === 'form'
          ? isEdit
            ? 'Altere os dados e clique em Gravar para salvar e conferir a DANFE. Depois use Enviar na listagem.'
            : 'Preencha os dados e use Pré-visualização antes de gravar. O envio à SEFAZ é feito na listagem.'
          : `${preview?.partnerName ?? ''} · Série ${preview?.series ?? '—'} / Nº ${preview?.number ?? '—'} · Total R$ ${preview?.total?.toFixed(2) ?? '—'}`
      }
      footer={footer}
    >
      <ErrorBox message={error} />

      {loadingDraft ? (
        <p className="text-sm text-slate-600">Carregando dados da nota…</p>
      ) : null}

      {step === 'preview' && preview ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {isEdit
              ? 'Rascunho atualizado. Confira abaixo como a DANFE será impressa e use Enviar na listagem quando estiver pronto.'
              : (
                  <>
                    Confira abaixo como a DANFE será impressa. Se estiver correto, grave o rascunho e use{' '}
                    <strong>Enviar</strong> na listagem de documentos.
                  </>
                )}
          </p>
          <iframe
            title="Pré-visualização DANFE"
            className="h-[min(60vh,520px)] w-full rounded-md border border-slate-200 bg-white"
            srcDoc={preview.html}
          />
        </div>
      ) : (
        <form id="manual-nfe-form" onSubmit={(ev) => void onFormSubmit(ev)} className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Destinatário</h3>
            <div className="mb-3 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="destModeUi"
                  checked={destMode === 'registered'}
                  onChange={() => setDestMode('registered')}
                />
                Cliente cadastrado
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="destModeUi"
                  checked={destMode === 'manual'}
                  onChange={() => setDestMode('manual')}
                />
                Dados manuais
              </label>
            </div>

            {destMode === 'registered' ? (
              <PartnerLookupField
                role="customer"
                required
                value={partnerId}
                onValueChange={(id) => setPartnerId(id)}
                label="Cliente"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tipo pessoa">
                  <select name="personType" className={inputClass} defaultValue="PJ">
                    <option value="PJ">Pessoa jurídica (CNPJ)</option>
                    <option value="PF">Pessoa física (CPF)</option>
                  </select>
                </Field>
                <Field label="Nome / razão social">
                  <input name="destName" className={inputClass} required maxLength={120} />
                </Field>
                <Field label="CNPJ">
                  <input name="cnpj" className={inputClass} placeholder="Somente PJ" />
                </Field>
                <Field label="CPF">
                  <input name="cpf" className={inputClass} placeholder="Somente PF" />
                </Field>
                <Field label="Inscrição estadual">
                  <input name="stateRegistration" className={inputClass} placeholder="ISENTO se não contribuinte" />
                </Field>
                <Field label="E-mail">
                  <input name="email" type="email" className={inputClass} />
                </Field>
                <Field label="Telefone">
                  <input name="phone" className={inputClass} />
                </Field>
                <Field label="CEP">
                  <input name="zipCode" className={inputClass} />
                </Field>
                <Field label="Logradouro">
                  <input name="street" className={inputClass} />
                </Field>
                <Field label="Número">
                  <input name="addressNumber" className={inputClass} />
                </Field>
                <Field label="Bairro">
                  <input name="district" className={inputClass} />
                </Field>
                <Field label="Município">
                  <input name="city" className={inputClass} />
                </Field>
                <Field label="UF">
                  <input name="state" className={inputClass} maxLength={2} placeholder="AM" />
                </Field>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Itens da nota</h3>
            <div className="space-y-4">
              {lines.map((line, index) => (
                <div key={line.key} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-700">Item {index + 1}</span>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          checked={line.mode === 'catalog'}
                          onChange={() => updateLine(line.key, { mode: 'catalog' })}
                        />
                        Produto cadastrado
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          checked={line.mode === 'manual'}
                          onChange={() => updateLine(line.key, { mode: 'manual' })}
                        />
                        Item avulso
                      </label>
                      {lines.length > 1 ? (
                        <Button type="button" variant="secondary" onClick={() => removeLine(line.key)}>
                          Remover
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {line.mode === 'catalog' ? (
                    <ProductLookupField
                      label="Produto"
                      required
                      value={line.productId}
                      onValueChange={(id) => updateLine(line.key, { productId: id })}
                    />
                  ) : (
                    <div className="mb-3 grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Field label="Descrição">
                          <input
                            className={inputClass}
                            value={line.description}
                            onChange={(ev) => updateLine(line.key, { description: ev.target.value })}
                            required
                          />
                        </Field>
                      </div>
                      <Field label="Situação fiscal (NCM/CST)">
                        <select
                          className={inputClass}
                          value={line.fiscalSituationId}
                          onChange={(ev) => updateLine(line.key, { fiscalSituationId: ev.target.value })}
                          required
                        >
                          {fiscalSituations.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.code} — {f.description}
                              {f.ncm ? ` · NCM ${f.ncm}` : ''}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Unidade">
                        <input
                          className={inputClass}
                          value={line.unit}
                          onChange={(ev) => updateLine(line.key, { unit: ev.target.value })}
                        />
                      </Field>
                    </div>
                  )}

                  <OperationNatureLookupField
                    required
                    value={line.operationNatureId}
                    onValueChange={(id) => updateLine(line.key, { operationNatureId: id })}
                  />

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <Field label="Quantidade">
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(ev) => updateLine(line.key, { quantity: ev.target.value })}
                        required
                      />
                    </Field>
                    <Field label="Valor unitário (R$)">
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        value={line.unitPrice}
                        onChange={(ev) => updateLine(line.key, { unitPrice: ev.target.value })}
                        required
                      />
                    </Field>
                    <Field label="Desconto (R$)">
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        value={line.discount}
                        onChange={(ev) => updateLine(line.key, { discount: ev.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="secondary" className="mt-3" onClick={addLine}>
              + Adicionar item
            </Button>
          </section>
        </form>
      )}
    </FormCadastroModal>
  );
}

'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { PageIntro } from '@/components/crud';
import { Modal, PaginatedTable, usePagination } from '@/components/list-crud';
import { ErrorBox, Field, PageCard, SubmitButton, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
const RUBRIC_KIND_LABEL: Record<string, string> = {
  EARNING: 'Provento',
  DEDUCTION: 'Desconto',
  INFORMATIVE: 'Informativa',
};

type PayrollRubric = {
  id: string;
  code: string;
  description: string;
  kind: string;
  natureCode: string;
  incidenceCp: string;
  incidenceFgts: string;
  incidenceIrrf: string;
  isSystem: boolean;
};

export default function FolhaRubricasPage() {
  const [rows, setRows] = useState<PayrollRubric[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<PayrollRubric | null>(null);

  const load = useCallback(() => {
    void apiFetch<PayrollRubric[]>('/v1/hr/payroll-rubrics')
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar rubricas'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { slice, page, setPage, totalPages, total } = usePagination(rows);

  async function saveDescription(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setError(null);
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    try {
      await apiFetch(`/v1/hr/payroll-rubrics/${edit.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ description: fd.get('description') }),
      });
      setEdit(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  return (
    <AdminShell title="Rubricas da folha">
      <PageIntro
        title="Rubricas da folha"
        description="Cadastro de referência eSocial S-1010 — códigos usados na geração da folha. Envio ao governo não está ativo nesta versão."
      />
      {error ? <ErrorBox message={error} /> : null}
      <PageCard>
        <PaginatedTable
          headers={['Código', 'Descrição', 'Tipo', 'Nat. / incidências', '']}
          recordItems={slice}
          rows={slice.map((r) => [
            r.code,
            r.description,
            RUBRIC_KIND_LABEL[r.kind] ?? r.kind,
            `${r.natureCode} · CP ${r.incidenceCp} · FGTS ${r.incidenceFgts} · IRRF ${r.incidenceIrrf}`,
            <button
              key={r.id}
              type="button"
              className="text-sm text-teal-700 hover:underline"
              onClick={() => setEdit(r)}
            >
              Editar descrição
            </button>,
          ])}
          page={page}
          totalPages={totalPages}
          total={total}
          onPage={setPage}
        />
        <p className="mt-4 text-xs text-slate-500">
          Documentação:{' '}
          <a
            className="text-teal-700 underline"
            href="https://www.gov.br/esocial/pt-br/documentacao-tecnica/leiautes-esocial-versao-1-3-nt-03-2025/index.html"
            target="_blank"
            rel="noreferrer"
          >
            eSocial S-1.3 — leiautes
          </a>
        </p>
      </PageCard>

      <Modal open={!!edit} title={`Rubrica ${edit?.code ?? ''}`} onClose={() => setEdit(null)}>
        {edit ? (
          <form onSubmit={saveDescription} className="space-y-3">
            <Field label="Descrição no holerite / folha">
              <input name="description" className={inputClass} required defaultValue={edit.description} />
            </Field>
            {edit.isSystem ? (
              <p className="text-xs text-slate-500">
                Rubrica do sistema: código e incidências eSocial não podem ser alterados aqui.
              </p>
            ) : null}
            <SubmitButton label="Salvar" />
          </form>
        ) : null}
      </Modal>
    </AdminShell>
  );
}

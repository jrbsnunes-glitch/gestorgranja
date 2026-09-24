'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@gestor-granja/ui';
import { HrLeavesReportLauncher } from '@/components/hr-leaves-report-launcher';
import { ModuleReportsModal, PageIntro, useCrudList } from '@/components/crud';
import {
  DetailGrid,
  ListToolbar,
  Modal,
  PaginatedTable,
  RowActions,
  usePagination,
  type ModalMode,
} from '@/components/list-crud';
import { ErrorBox, Field, SubmitButton, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { labelEnum } from '@/lib/labels';
import { openHrLeaveEspelhoPrint } from '@/lib/hr-leaves-report-query';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';

type Employee = { id: string; name: string };
type Leave = {
  id: string;
  controlNumber: number;
  type: string;
  startsAt: string;
  endsAt: string;
  cidCode: string | null;
  notes: string | null;
  employee: { name: string; id: string };
};

export default function AtestadosPage() {
  const [rows, setRows] = useState<Leave[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<Leave | null>(null);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [reportSeedLeaveId, setReportSeedLeaveId] = useState<string | undefined>();

  const list = useCrudList({
    items: rows,
    searchFields: (l) => [l.employee.name, l.type, l.cidCode, l.notes],
    dateField: (l) => l.startsAt,
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<Leave[]>('/v1/hr/leaves').then(setRows);
  }, []);

  useEffect(() => {
    load();
    void apiFetch<Employee[]>('/v1/hr/employees').then(setEmployees);
  }, [load]);

  function open(mode: ModalMode, row?: Leave) {
    setSelected(row ?? null);
    setModal(mode);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      employeeId: fd.get('employeeId'),
      type: fd.get('type'),
      startsAt: fd.get('startsAt'),
      endsAt: fd.get('endsAt'),
      cidCode: fd.get('cidCode') || undefined,
      notes: fd.get('notes') || undefined,
    };
    try {
      if (modal === 'edit' && selected) {
        await apiFetch(`/v1/hr/leaves/${selected.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/v1/hr/leaves', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function remove(row: Leave) {
    if (!confirm('Excluir registro?')) return;
    await apiFetch(`/v1/hr/leaves/${row.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <AdminShell title="Atestados / afastamentos">
      <PageIntro
        title="Atestados e afastamentos"
        description="Registro de afastamentos médicos e outros, com impacto na folha por dias ausentes."
      />
      <ErrorBox message={error} />
      <ListToolbar
        list={list}
        onInclude={() => open('include')}
        onReports={() => {
          setReportSeedLeaveId(selected?.id);
          setReportsOpen(true);
        }}
        label="Registrar atestado"
        searchPlaceholder="Funcionário, CID, observação…"
        showDateFilter
      />
      <PaginatedTable
        headers={['Funcionário', 'Tipo', 'Início', 'Fim', 'CID', 'Ações']}
        recordItems={slice}
        rows={slice.map((l) => [
          l.employee.name,
          l.type === 'MEDICAL' ? 'Médico' : 'Outro',
          formatCalendarDatePtBR(l.startsAt),
          formatCalendarDatePtBR(l.endsAt),
          l.cidCode ?? '—',
          <RowActions
            key={l.id}
            onView={() => open('view', l)}
            onEdit={() => open('edit', l)}
            onDelete={() => void remove(l)}
          />,
        ])}
        page={page}
        totalPages={totalPages}
        total={total}
        onPage={setPage}
      />

      <Modal title="Atestado" open={modal !== null} onClose={() => setModal(null)}>
        {modal === 'view' && selected ? (
          <>
          <DetailGrid
            entries={[
              ['Controle', String(selected.controlNumber)],
              ['Funcionário', selected.employee.name],
              ['Tipo', labelEnum(selected.type)],
              ['Início', formatCalendarDatePtBR(selected.startsAt)],
              ['Fim', formatCalendarDatePtBR(selected.endsAt)],
              ['CID', selected.cidCode ?? '—'],
              ['Obs.', selected.notes ?? '—'],
            ]}
          />
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={() => openHrLeaveEspelhoPrint(selected.id, '/rh/atestados')}
          >
            Espelho do atestado
          </Button>
          </>
        ) : (
          <form onSubmit={save}>
            <Field label="Funcionário">
              <select name="employeeId" className={inputClass} required defaultValue={selected?.employee.id ?? ''}>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tipo">
              <select name="type" className={inputClass} defaultValue={selected?.type ?? 'MEDICAL'}>
                <option value="MEDICAL">Atestado médico</option>
                <option value="OTHER">Outro</option>
              </select>
            </Field>
            <Field label="Início">
              <input
                name="startsAt"
                type="date"
                className={inputClass}
                required
                defaultValue={selected?.startsAt.slice(0, 10) ?? ''}
              />
            </Field>
            <Field label="Fim">
              <input
                name="endsAt"
                type="date"
                className={inputClass}
                required
                defaultValue={selected?.endsAt.slice(0, 10) ?? ''}
              />
            </Field>
            <Field label="CID">
              <input name="cidCode" className={inputClass} defaultValue={selected?.cidCode ?? ''} />
            </Field>
            <Field label="Observação">
              <input name="notes" className={inputClass} defaultValue={selected?.notes ?? ''} />
            </Field>
            <SubmitButton label="Salvar" />
          </form>
        )}
      </Modal>

      <ModuleReportsModal
        open={reportsOpen}
        title="Atestados"
        onClose={() => {
          setReportsOpen(false);
          setReportSeedLeaveId(undefined);
        }}
        compactLauncher
        wide
      >
        <HrLeavesReportLauncher returnHref="/rh/atestados" initialLeaveId={reportSeedLeaveId} />
      </ModuleReportsModal>
    </AdminShell>
  );
}

'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@gestor-granja/ui';
import { HrVacationsReportLauncher } from '@/components/hr-vacations-report-launcher';
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
import { openHrVacationEspelhoPrint } from '@/lib/hr-vacations-report-query';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';

type Employee = { id: string; name: string };
type Vacation = {
  id: string;
  controlNumber: number;
  acquisitionYear: number;
  startsAt: string;
  endsAt: string;
  status: string;
  employee: { name: string; id: string };
};

export default function FeriasPage() {
  const [rows, setRows] = useState<Vacation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<Vacation | null>(null);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [reportSeedVacationId, setReportSeedVacationId] = useState<string | undefined>();

  const list = useCrudList({
    items: rows,
    searchFields: (v) => [v.employee.name, v.status, String(v.acquisitionYear)],
    dateField: (v) => v.startsAt,
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<Vacation[]>('/v1/hr/vacations').then(setRows);
  }, []);

  useEffect(() => {
    load();
    void apiFetch<Employee[]>('/v1/hr/employees').then(setEmployees);
  }, [load]);

  function open(mode: ModalMode, row?: Vacation) {
    setSelected(row ?? null);
    setModal(mode);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      employeeId: fd.get('employeeId'),
      acquisitionYear: Number(fd.get('acquisitionYear')),
      startsAt: fd.get('startsAt'),
      endsAt: fd.get('endsAt'),
      status: fd.get('status') || undefined,
    };
    try {
      if (modal === 'edit' && selected) {
        await apiFetch(`/v1/hr/vacations/${selected.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/v1/hr/vacations', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function remove(row: Vacation) {
    if (!confirm('Excluir programação?')) return;
    await apiFetch(`/v1/hr/vacations/${row.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <AdminShell title="Férias">
      <PageIntro title="Férias" description="Programação de férias por funcionário e período aquisitivo." />
      <ErrorBox message={error} />
      <ListToolbar
        list={list}
        onInclude={() => open('include')}
        onReports={() => {
          setReportSeedVacationId(selected?.id);
          setReportsOpen(true);
        }}
        label="Agendar férias"
        searchPlaceholder="Funcionário, status, ano…"
        showDateFilter
      />
      <PaginatedTable
        headers={['Funcionário', 'Aquisitivo', 'Início', 'Fim', 'Status', 'Ações']}
        recordItems={slice}
        rows={slice.map((v) => [
          v.employee.name,
          String(v.acquisitionYear),
          formatCalendarDatePtBR(v.startsAt),
          formatCalendarDatePtBR(v.endsAt),
          labelEnum(v.status),
          <RowActions
            key={v.id}
            onView={() => open('view', v)}
            onEdit={() => open('edit', v)}
            onDelete={() => void remove(v)}
          />,
        ])}
        page={page}
        totalPages={totalPages}
        total={total}
        onPage={setPage}
      />

      <Modal title="Férias" open={modal !== null} onClose={() => setModal(null)}>
        {modal === 'view' && selected ? (
          <>
            <DetailGrid
              entries={[
                ['Controle', String(selected.controlNumber)],
                ['Funcionário', selected.employee.name],
                ['Ano aquisitivo', String(selected.acquisitionYear)],
                ['Início', formatCalendarDatePtBR(selected.startsAt)],
                ['Fim', formatCalendarDatePtBR(selected.endsAt)],
                ['Status', labelEnum(selected.status)],
              ]}
            />
            <Button
              type="button"
              variant="secondary"
              className="mt-4"
              onClick={() => openHrVacationEspelhoPrint(selected.id, '/rh/ferias')}
            >
              Espelho de férias
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
            <Field label="Ano aquisitivo">
              <input
                name="acquisitionYear"
                type="number"
                className={inputClass}
                required
                defaultValue={selected?.acquisitionYear ?? new Date().getFullYear() - 1}
              />
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
            {modal === 'edit' ? (
              <Field label="Status">
                <select name="status" className={inputClass} defaultValue={selected?.status ?? 'PLANNED'}>
                  <option value="PLANNED">Planejada</option>
                  <option value="IN_PROGRESS">Em gozo</option>
                  <option value="DONE">Concluída</option>
                  <option value="CANCELLED">Cancelada</option>
                </select>
              </Field>
            ) : null}
            <SubmitButton label="Salvar" />
          </form>
        )}
      </Modal>

      <ModuleReportsModal
        open={reportsOpen}
        title="Férias"
        onClose={() => {
          setReportsOpen(false);
          setReportSeedVacationId(undefined);
        }}
        compactLauncher
        wide
      >
        <HrVacationsReportLauncher returnHref="/rh/ferias" initialVacationId={reportSeedVacationId} />
      </ModuleReportsModal>
    </AdminShell>
  );
}

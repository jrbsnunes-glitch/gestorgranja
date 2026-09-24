'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import {
  FormCadastroModal,
  ModuleReportsModal,
  PageIntro,
  RecordViewModal,
  useCrudList,
} from '@/components/crud';
import { ListToolbar, PaginatedTable, RowActions, TabBar, usePagination, type ModalMode } from '@/components/list-crud';
import { PartnerForm, partnerToForm, type PartnerFormValues } from '@/components/partner-form';
import { ErrorBox } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { formatCep } from '@/lib/viacep';

type Partner = {
  id: string;
  personType: 'PF' | 'PJ';
  name: string;
  tradeName: string | null;
  document: string | null;
  cpf: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  stateRegistration: string | null;
  zipCode: string | null;
  street: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  isCustomer: boolean;
  isSupplier: boolean;
};

type PartnerTab = 'clientes' | 'fornecedores';

function displayDocument(p: Partner) {
  return p.cpf || p.cnpj || p.document || '—';
}

function formatAddress(p: Partner) {
  return (
    [p.street, p.addressNumber, p.addressComplement, p.district, p.city, p.state, p.zipCode ? formatCep(p.zipCode) : null]
      .filter(Boolean)
      .join(', ') || '—'
  );
}

export default function ParceirosPage() {
  const [tab, setTab] = useState<PartnerTab>('clientes');
  const [rows, setRows] = useState<Partner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [selected, setSelected] = useState<Partner | null>(null);

  const tabRows = useMemo(
    () => rows.filter((p) => (tab === 'clientes' ? p.isCustomer : p.isSupplier)),
    [rows, tab],
  );
  const list = useCrudList({
    items: tabRows,
    searchFields: (p) => [p.name, p.tradeName, p.cpf, p.cnpj, p.document, p.city, p.email],
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<Partner[]>('/v1/cadastros/partners').then(setRows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [tab, setPage]);

  function openForm(mode: 'include' | 'edit', row?: Partner) {
    setSelected(row ?? null);
    setModal(mode);
    setError(null);
  }

  function flagsForSave() {
    if (modal === 'edit' && selected) {
      return tab === 'clientes'
        ? { isCustomer: true, isSupplier: selected.isSupplier }
        : { isCustomer: selected.isCustomer, isSupplier: true };
    }
    return tab === 'clientes'
      ? { isCustomer: true, isSupplier: false }
      : { isCustomer: false, isSupplier: true };
  }

  function formInitial(): PartnerFormValues {
    if (selected) {
      return partnerToForm({
        personType: selected.personType,
        name: selected.name,
        tradeName: selected.tradeName ?? '',
        cpf: selected.cpf ?? '',
        cnpj: selected.cnpj ?? '',
        email: selected.email ?? '',
        phone: selected.phone ?? '',
        mobile: selected.mobile ?? '',
        stateRegistration: selected.stateRegistration ?? '',
        zipCode: selected.zipCode ?? '',
        street: selected.street ?? '',
        addressNumber: selected.addressNumber ?? '',
        addressComplement: selected.addressComplement ?? '',
        district: selected.district ?? '',
        city: selected.city ?? '',
        state: selected.state ?? '',
      });
    }
    return partnerToForm({ personType: tab === 'clientes' ? 'PF' : 'PJ' });
  }

  async function save(values: PartnerFormValues) {
    setError(null);
    const body = { ...values, ...flagsForSave() };
    try {
      if (modal === 'edit' && selected) {
        await apiFetch(`/v1/cadastros/partners/${selected.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/v1/cadastros/partners', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  const tabLabel = tab === 'clientes' ? 'cliente' : 'fornecedor';
  const reportsTitle = tab === 'clientes' ? 'Clientes' : 'Fornecedores';

  const tableRows = slice.map((p) => [
    p.tradeName && p.personType === 'PJ' ? `${p.name} (${p.tradeName})` : p.name,
    displayDocument(p),
    p.city ?? '—',
    <RowActions
      key={p.id}
      onView={() => {
        setSelected(p);
        setViewOpen(true);
      }}
      onEdit={() => openForm('edit', p)}
    />,
  ]);

  return (
    <AdminShell title="Parceiros (clientes / fornecedores)">
      <PageIntro
        title="Parceiros"
        description="Clientes e fornecedores com documentos, contato e endereço para vendas e compras."
      />
      <ErrorBox message={error} />
      <TabBar
        active={tab}
        onChange={(id) => setTab(id as PartnerTab)}
        tabs={[
          { id: 'clientes', label: 'Clientes' },
          { id: 'fornecedores', label: 'Fornecedores' },
        ]}
      />
      <ListToolbar
        list={list}
        onInclude={() => openForm('include')}
        onReports={() => setReportsOpen(true)}
        label={`Incluir ${tabLabel}`}
        searchPlaceholder="Nome, documento, cidade…"
      />
      <PaginatedTable
        headers={['Nome', 'CPF/CNPJ', 'Cidade', 'Ações']}
        recordItems={slice}
        rows={tableRows}
        page={page}
        totalPages={totalPages}
        total={total}
        onPage={setPage}
      />

      <FormCadastroModal
        open={modal === 'include' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'edit' ? `Alterar ${tabLabel}` : `Incluir ${tabLabel}`}
        wide
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="partner-form">
              Salvar
            </Button>
          </>
        }
      >
        <PartnerForm
          key={`${selected?.id ?? 'new'}-${tab}-${modal}`}
          formId="partner-form"
          hideSubmit
          initial={formInitial()}
          submitLabel="Salvar"
          showStateRegistration={tab === 'fornecedores'}
          onSubmit={save}
        />
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title={`Visualizar ${tabLabel}`}
        wide
        sections={
          selected
            ? [
                {
                  title: 'Identificação',
                  fields: [
                    { label: 'Tipo', value: selected.personType === 'PF' ? 'Pessoa física' : 'Pessoa jurídica' },
                    { label: 'Nome / razão social', value: selected.name },
                    { label: 'Nome fantasia', value: selected.tradeName ?? '—' },
                    { label: 'CPF', value: selected.cpf ?? '—' },
                    { label: 'CNPJ', value: selected.cnpj ?? '—' },
                    { label: 'IE', value: selected.stateRegistration ?? '—' },
                  ],
                },
                {
                  title: 'Contato',
                  fields: [
                    { label: 'E-mail', value: selected.email ?? '—' },
                    { label: 'Telefone', value: selected.phone ?? '—' },
                    { label: 'Celular', value: selected.mobile ?? '—' },
                  ],
                },
                {
                  title: 'Endereço',
                  fields: [{ label: 'Endereço completo', value: formatAddress(selected) }],
                },
              ]
            : []
        }
      />

      <ModuleReportsModal open={reportsOpen} title={reportsTitle} onClose={() => setReportsOpen(false)} compactLauncher />
    </AdminShell>
  );
}

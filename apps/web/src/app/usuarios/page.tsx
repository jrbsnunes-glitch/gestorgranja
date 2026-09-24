'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { ModuleReportsModal, PageIntro, useCrudList } from '@/components/crud';
import {
  DetailGrid,
  ListToolbar,
  Modal,
  PaginatedTable,
  RowActions,
  TabBar,
  usePagination,
  type ModalMode,
} from '@/components/list-crud';
import { ErrorBox, Field, SubmitButton, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { labelRole, SYSTEM_ROLE_OPTIONS } from '@/lib/labels';

type RoleAssignment = {
  role: { name: string };
  barn: { name: string } | null;
};

type UserRow = {
  id: string;
  username: string;
  email: string;
  name: string;
  isActive: boolean;
  roleAssignments: RoleAssignment[];
};

type Barn = { id: string; code: string; name: string };

type AssignmentRow = {
  key: string;
  userId: string;
  userLabel: string;
  roleName: string;
  barnLabel: string;
};

export default function UsuariosPage() {
  const [tab, setTab] = useState('usuarios');
  const [rows, setRows] = useState<UserRow[]>([]);
  const [barns, setBarns] = useState<Barn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [viewAssignment, setViewAssignment] = useState<AssignmentRow | null>(null);
  const [reportsOpen, setReportsOpen] = useState(false);

  const userList = useCrudList({
    items: rows,
    searchFields: (u) => [
      u.username,
      u.name,
      u.email,
      u.roleAssignments.map((a) => a.role.name).join(' '),
    ],
  });
  const userPag = usePagination(userList.filtered);

  const assignments = useMemo<AssignmentRow[]>(
    () =>
      rows.flatMap((u) =>
        u.roleAssignments.map((a, i) => ({
          key: `${u.id}-${i}`,
          userId: u.id,
          userLabel: `${u.username} — ${u.name}`,
          roleName: a.role.name,
          barnLabel: a.barn?.name ?? 'Global',
        })),
      ),
    [rows],
  );
  const assignList = useCrudList({
    items: assignments,
    searchFields: (a) => [a.userLabel, a.roleName, a.barnLabel],
  });
  const assignPag = usePagination(assignList.filtered);

  const load = useCallback(() => {
    void apiFetch<UserRow[]>('/v1/users').then(setRows);
  }, []);

  useEffect(() => {
    load();
    void apiFetch<Barn[]>('/v1/cadastros/barns').then(setBarns);
  }, [load]);

  useEffect(() => {
    userPag.setPage(0);
    assignPag.setPage(0);
  }, [tab, userPag.setPage, assignPag.setPage]);

  async function saveUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      if (modal === 'edit' && selected) {
        await apiFetch(`/v1/users/${selected.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: fd.get('name') }),
        });
      } else {
        await apiFetch('/v1/users', {
          method: 'POST',
          body: JSON.stringify({
            email: fd.get('email'),
            username: fd.get('username') || undefined,
            name: fd.get('name'),
            password: fd.get('password'),
            roleName: fd.get('roleName'),
          }),
        });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function assignRole(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const barn = String(fd.get('barnId') || '');
    try {
      await apiFetch('/v1/users/assign-role', {
        method: 'POST',
        body: JSON.stringify({
          userId: fd.get('userId'),
          roleName: fd.get('roleName'),
          barnId: barn || undefined,
        }),
      });
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function inactivateUser(u: UserRow) {
    if (!confirm(`Inativar usuário ${u.username}?`)) return;
    await apiFetch(`/v1/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: false }) });
    load();
  }

  const roleSelect = (
    <select name="roleName" className={inputClass} required defaultValue="admin">
      {SYSTEM_ROLE_OPTIONS.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </select>
  );

  const reportsTitle = tab === 'usuarios' ? 'Usuários' : 'Atribuições de perfil';

  return (
    <AdminShell title="Usuários e perfis">
      <PageIntro
        title="Usuários e perfis"
        description="Contas de acesso, perfis RBAC e escopo por galpão quando aplicável."
      />
      <ErrorBox message={error} />
      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'usuarios', label: 'Usuários' },
          { id: 'perfis', label: 'Atribuições de perfil' },
        ]}
      />

      {tab === 'usuarios' ? (
        <>
          <ListToolbar
            list={userList}
            onInclude={() => {
              setSelected(null);
              setModal('include');
            }}
            onReports={() => setReportsOpen(true)}
            searchPlaceholder="Usuário, nome, e-mail…"
          />
          <PaginatedTable
            headers={['Usuário', 'Nome', 'E-mail', 'Perfis', 'Ativo', 'Ações']}
            recordItems={userPag.slice}
            rows={userPag.slice.map((u) => [
              u.username,
              u.name,
              u.email,
              u.roleAssignments
                .map((a) =>
                  a.barn ? `${labelRole(a.role.name)} @ ${a.barn.name}` : labelRole(a.role.name),
                )
                .join(', ') || '—',
              u.isActive ? 'Sim' : 'Não',
              <RowActions
                key={u.id}
                onView={() => {
                  setSelected(u);
                  setModal('view');
                }}
                onEdit={() => {
                  setSelected(u);
                  setModal('edit');
                }}
                onInactivate={u.isActive ? () => void inactivateUser(u) : undefined}
              />,
            ])}
            page={userPag.page}
            totalPages={userPag.totalPages}
            total={userPag.total}
            onPage={userPag.setPage}
          />
        </>
      ) : (
        <>
          <ListToolbar
            list={assignList}
            onInclude={() => setModal('include')}
            onReports={() => setReportsOpen(true)}
            label="Incluir atribuição"
            searchPlaceholder="Usuário, perfil, galpão…"
          />
          <PaginatedTable
            headers={['Usuário', 'Perfil', 'Galpão', 'Ações']}
            recordItems={assignPag.slice}
            rows={assignPag.slice.map((a) => [
              a.userLabel,
              labelRole(a.roleName),
              a.barnLabel,
              <RowActions
                key={a.key}
                onView={() => {
                  setViewAssignment(a);
                  setModal('view');
                }}
              />,
            ])}
            page={assignPag.page}
            totalPages={assignPag.totalPages}
            total={assignPag.total}
            onPage={assignPag.setPage}
          />
        </>
      )}

      <Modal
        title={
          tab === 'usuarios'
            ? modal === 'view'
              ? 'Visualizar usuário'
              : modal === 'edit'
                ? 'Editar usuário'
                : 'Incluir usuário'
            : modal === 'view'
              ? 'Visualizar atribuição'
              : 'Incluir atribuição de perfil'
        }
        open={modal !== null}
        onClose={() => setModal(null)}
      >
        {tab === 'usuarios' && modal === 'view' && selected ? (
          <DetailGrid
            entries={[
              ['Usuário', selected.username],
              ['Nome', selected.name],
              ['E-mail', selected.email],
              ['Ativo', selected.isActive ? 'Sim' : 'Não'],
              [
                'Perfis',
                selected.roleAssignments
                  .map((a) =>
                    a.barn ? `${labelRole(a.role.name)} @ ${a.barn.name}` : labelRole(a.role.name),
                  )
                  .join(', ') || '—',
              ],
            ]}
          />
        ) : null}
        {tab === 'perfis' && modal === 'view' && viewAssignment ? (
          <DetailGrid
            entries={[
              ['Usuário', viewAssignment.userLabel],
              ['Perfil', labelRole(viewAssignment.roleName)],
              ['Galpão', viewAssignment.barnLabel],
            ]}
          />
        ) : null}
        {tab === 'usuarios' && modal !== null && modal !== 'view' ? (
          <form onSubmit={saveUser} key={selected?.id ?? 'new'}>
            <Field label="Nome">
              <input name="name" className={inputClass} required defaultValue={selected?.name} />
            </Field>
            {modal === 'include' ? (
              <>
                <Field label="Usuário (login)">
                  <input name="username" className={inputClass} placeholder="joao.silva" />
                </Field>
                <Field label="E-mail (interno)">
                  <input name="email" type="email" className={inputClass} required />
                </Field>
                <Field label="Senha inicial">
                  <input name="password" type="password" className={inputClass} required minLength={6} />
                </Field>
                <Field label="Perfil inicial">{roleSelect}</Field>
              </>
            ) : null}
            <SubmitButton label={modal === 'edit' ? 'Salvar alterações' : 'Criar usuário'} />
          </form>
        ) : null}
        {tab === 'perfis' && modal === 'include' ? (
          <form onSubmit={assignRole}>
            <Field label="Usuário">
              <select name="userId" className={inputClass} required>
                <option value="">Selecione…</option>
                {rows.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} — {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Perfil">{roleSelect}</Field>
            <Field label="Galpão (opcional — escopo)">
              <select name="barnId" className={inputClass}>
                <option value="">Todos / global</option>
                {barns.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <SubmitButton label="Atribuir perfil" />
          </form>
        ) : null}
      </Modal>

      <ModuleReportsModal open={reportsOpen} title={reportsTitle} onClose={() => setReportsOpen(false)} compactLauncher />
    </AdminShell>
  );
}

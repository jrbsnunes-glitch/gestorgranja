'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { FormCadastroModal, ModuleReportsModal, PageIntro, useCrudList } from '@/components/crud';
import { ListToolbar, PaginatedTable, TabBar, usePagination } from '@/components/list-crud';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';

type City = { id: string; name: string; state: string; ibgeCode: string | null };
type District = { id: string; name: string; city: { name: string; state: string } };
type Bank = { id: string; compeCode: string; name: string; isActive: boolean };
type Fiscal = { id: string; code: string; description: string };
type StockLoc = { id: string; code: string; name: string };

const TABS = [
  { id: 'cidades', label: 'Cidades' },
  { id: 'bairros', label: 'Bairros' },
  { id: 'bancos', label: 'Bancos' },
  { id: 'fiscal', label: 'Situação fiscal' },
  { id: 'locais', label: 'Locais estoque' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function CadastrosGeraisPage() {
  const [tab, setTab] = useState<TabId>('cidades');
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [fiscal, setFiscal] = useState<Fiscal[]>([]);
  const [locais, setLocais] = useState<StockLoc[]>([]);
  const [filterCityId, setFilterCityId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  const cityList = useCrudList({
    items: cities,
    searchFields: (c) => [c.name, c.state, c.ibgeCode],
  });
  const districtList = useCrudList({
    items: districts,
    searchFields: (d) => [d.name, d.city.name, d.city.state],
  });
  const bankList = useCrudList({ items: banks, searchFields: (b) => [b.compeCode, b.name] });
  const fiscalList = useCrudList({ items: fiscal, searchFields: (f) => [f.code, f.description] });
  const locList = useCrudList({ items: locais, searchFields: (l) => [l.code, l.name] });

  const cityPag = usePagination(cityList.filtered);
  const distPag = usePagination(districtList.filtered);
  const bankPag = usePagination(bankList.filtered);
  const fiscalPag = usePagination(fiscalList.filtered);
  const locPag = usePagination(locList.filtered);

  const activeList = useMemo(() => {
    switch (tab) {
      case 'cidades':
        return cityList;
      case 'bairros':
        return districtList;
      case 'bancos':
        return bankList;
      case 'fiscal':
        return fiscalList;
      case 'locais':
        return locList;
    }
  }, [tab, cityList, districtList, bankList, fiscalList, locList]);

  const load = useCallback(() => {
    void apiFetch<City[]>('/v1/cadastros/general/cities').then(setCities);
    void apiFetch<Bank[]>('/v1/cadastros/general/banks').then(setBanks);
    void apiFetch<Fiscal[]>('/v1/cadastros/general/fiscal-situations').then(setFiscal);
    void apiFetch<StockLoc[]>('/v1/cadastros/general/stock-locations').then(setLocais);
  }, []);

  const loadDistricts = useCallback((cityId?: string) => {
    const q = cityId ? `?cityId=${encodeURIComponent(cityId)}` : '';
    void apiFetch<District[]>(`/v1/cadastros/general/districts${q}`).then(setDistricts);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'bairros') loadDistricts(filterCityId || undefined);
  }, [tab, filterCityId, loadDistricts]);

  async function submitForm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      if (tab === 'cidades') {
        await apiFetch('/v1/cadastros/general/cities', {
          method: 'POST',
          body: JSON.stringify({
            name: fd.get('name'),
            state: fd.get('state'),
            ibgeCode: fd.get('ibgeCode') || undefined,
          }),
        });
      } else if (tab === 'bairros') {
        await apiFetch('/v1/cadastros/general/districts', {
          method: 'POST',
          body: JSON.stringify({ name: fd.get('name'), cityId: fd.get('cityId') }),
        });
        loadDistricts(filterCityId || undefined);
      } else if (tab === 'bancos') {
        await apiFetch('/v1/cadastros/general/banks', {
          method: 'POST',
          body: JSON.stringify({ compeCode: fd.get('compeCode'), name: fd.get('name') }),
        });
      } else if (tab === 'fiscal') {
        await apiFetch('/v1/cadastros/general/fiscal-situations', {
          method: 'POST',
          body: JSON.stringify({ code: fd.get('code'), description: fd.get('description') }),
        });
      } else if (tab === 'locais') {
        await apiFetch('/v1/cadastros/general/stock-locations', {
          method: 'POST',
          body: JSON.stringify({ code: fd.get('code'), name: fd.get('name') }),
        });
      }
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  const modalTitle =
    tab === 'cidades'
      ? 'Incluir cidade'
      : tab === 'bairros'
        ? 'Incluir bairro'
        : tab === 'bancos'
          ? 'Incluir banco'
          : tab === 'fiscal'
            ? 'Incluir situação fiscal'
            : 'Incluir local';

  const reportsTitle =
    tab === 'cidades'
      ? 'Cidades'
      : tab === 'bairros'
        ? 'Bairros'
        : tab === 'bancos'
          ? 'Bancos'
          : tab === 'fiscal'
            ? 'Situação fiscal'
            : 'Locais de estoque';

  const searchPlaceholder =
    tab === 'cidades'
      ? 'Nome, UF ou IBGE…'
      : tab === 'bairros'
        ? 'Bairro ou cidade…'
        : tab === 'bancos'
          ? 'COMPE ou nome…'
          : tab === 'fiscal'
            ? 'Código ou descrição…'
            : 'Código ou nome…';

  return (
    <AdminShell title="Cadastros gerais">
      <PageIntro
        title="Cadastros gerais"
        description="Cidades, bairros, bancos, situação fiscal de produtos e locais de estoque compartilhados no sistema."
      />
      <ErrorBox message={error} />
      <TabBar active={tab} onChange={(id) => setTab(id as TabId)} tabs={[...TABS]} />

      {tab === 'bairros' ? (
        <div className="mb-4">
          <Field label="Filtrar por cidade">
            <select
              className={inputClass}
              value={filterCityId}
              onChange={(e) => setFilterCityId(e.target.value)}
            >
              <option value="">Todas</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.state}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      <ListToolbar
        list={activeList}
        onInclude={() => setFormOpen(true)}
        onReports={() => setReportsOpen(true)}
        searchPlaceholder={searchPlaceholder}
      />

      {tab === 'cidades' ? (
        <PaginatedTable
          headers={['Nome', 'UF', 'IBGE']}
          recordItems={cityPag.slice}
          rows={cityPag.slice.map((c) => [c.name, c.state, c.ibgeCode ?? '—'])}
          page={cityPag.page}
          totalPages={cityPag.totalPages}
          total={cityPag.total}
          onPage={cityPag.setPage}
        />
      ) : null}

      {tab === 'bairros' ? (
        <PaginatedTable
          headers={['Nome', 'Cidade']}
          recordItems={distPag.slice}
          rows={distPag.slice.map((d) => [d.name, `${d.city.name} (${d.city.state})`])}
          page={distPag.page}
          totalPages={distPag.totalPages}
          total={distPag.total}
          onPage={distPag.setPage}
        />
      ) : null}

      {tab === 'bancos' ? (
        <PaginatedTable
          headers={['COMPE', 'Nome', 'Ativo']}
          recordItems={bankPag.slice}
          rows={bankPag.slice.map((b) => [b.compeCode, b.name, b.isActive ? 'Sim' : 'Não'])}
          page={bankPag.page}
          totalPages={bankPag.totalPages}
          total={bankPag.total}
          onPage={bankPag.setPage}
        />
      ) : null}

      {tab === 'fiscal' ? (
        <PaginatedTable
          headers={['Código', 'Descrição']}
          recordItems={fiscalPag.slice}
          rows={fiscalPag.slice.map((f) => [f.code, f.description])}
          page={fiscalPag.page}
          totalPages={fiscalPag.totalPages}
          total={fiscalPag.total}
          onPage={fiscalPag.setPage}
        />
      ) : null}

      {tab === 'locais' ? (
        <PaginatedTable
          headers={['Código', 'Nome']}
          recordItems={locPag.slice}
          rows={locPag.slice.map((l) => [l.code, l.name])}
          page={locPag.page}
          totalPages={locPag.totalPages}
          total={locPag.total}
          onPage={locPag.setPage}
        />
      ) : null}

      <FormCadastroModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={modalTitle}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="cadastros-gerais-form">
              Salvar
            </Button>
          </>
        }
      >
        <form id="cadastros-gerais-form" onSubmit={submitForm} key={tab}>
          {tab === 'cidades' ? (
            <>
              <Field label="Nome">
                <input name="name" className={inputClass} required />
              </Field>
              <Field label="UF">
                <input name="state" className={inputClass} required maxLength={2} />
              </Field>
              <Field label="Código IBGE">
                <input name="ibgeCode" className={inputClass} />
              </Field>
            </>
          ) : null}
          {tab === 'bairros' ? (
            <>
              <Field label="Cidade">
                <select name="cityId" className={inputClass} required defaultValue={filterCityId || cities[0]?.id}>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.state}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nome do bairro">
                <input name="name" className={inputClass} required />
              </Field>
            </>
          ) : null}
          {tab === 'bancos' ? (
            <>
              <Field label="Código COMPE">
                <input name="compeCode" className={inputClass} required />
              </Field>
              <Field label="Nome">
                <input name="name" className={inputClass} required />
              </Field>
            </>
          ) : null}
          {tab === 'fiscal' ? (
            <>
              <Field label="Código">
                <input name="code" className={inputClass} required />
              </Field>
              <Field label="Descrição">
                <input name="description" className={inputClass} required />
              </Field>
            </>
          ) : null}
          {tab === 'locais' ? (
            <>
              <Field label="Código">
                <input name="code" className={inputClass} required />
              </Field>
              <Field label="Nome">
                <input name="name" className={inputClass} required />
              </Field>
            </>
          ) : null}
        </form>
      </FormCadastroModal>

      <ModuleReportsModal open={reportsOpen} title={reportsTitle} onClose={() => setReportsOpen(false)} compactLauncher />
    </AdminShell>
  );
}

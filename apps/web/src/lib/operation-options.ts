'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export type LotOption = { id: string; code: string; barnId: string; status: string; barn: { id: string; code: string; name: string } };
export type BarnOption = { id: string; code: string; name: string };
export type ProductOption = { id: string; sku: string; name: string; unit: string; type: string };
export type StockLocationOption = { id: string; code: string; name: string; barnId: string | null };
export type AssetOption = { id: string; code: string; name: string; barnId: string | null };

function useList<T>(path: string | null): T[] {
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    void apiFetch<T[]>(path)
      .then((r) => {
        if (alive) setRows(r);
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  return rows;
}

export function useLotOptions() {
  return useList<LotOption>('/v1/production/lots');
}

export function useBarnOptions() {
  return useList<BarnOption>('/v1/cadastros/barns');
}

/** Produtos para operação; `type` filtra (FEED, MEDICATION, SUPPLY…). */
export function useProductOptions(type?: string) {
  return useList<ProductOption>(`/v1/operation/product-options${type ? `?type=${type}` : ''}`);
}

export function useStockLocationOptions() {
  return useList<StockLocationOption>('/v1/operation/stock-location-options');
}

export function useAssetOptions() {
  return useList<AssetOption>('/v1/operation/occurrences/asset-options');
}

export function lotLabel(l: { code: string; barn?: { name: string } | null }) {
  return l.barn ? `${l.code} — ${l.barn.name}` : l.code;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function toLocalDateTimeInput(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

import { campoDb, type SyncQueueItem } from './db';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3010/api';

export async function flushSyncQueue(token: string) {
  const pending = await campoDb.syncQueue.where('status').equals('pending').toArray();
  if (!pending.length) return { flushed: 0 };

  const res = await fetch(`${API}/v1/sync/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      operations: pending.map((p) => ({
        operationId: p.operationId,
        type: p.type,
        payload: p.payload,
        clientUpdatedAt: p.clientUpdatedAt,
      })),
    }),
  });

  if (!res.ok) throw new Error(await res.text());

  const body = (await res.json()) as {
    results: { operationId: string; status: string }[];
  };
  const statusById = new Map(body.results.map((r) => [r.operationId, r.status]));
  let flushed = 0;
  for (const p of pending) {
    const st = statusById.get(p.operationId);
    if (st === 'ok' || st === 'duplicate') {
      await campoDb.syncQueue.update(p.operationId, { status: 'sent' });
      flushed += 1;
    }
  }
  return { flushed };
}

export async function enqueue(
  item: Omit<SyncQueueItem, 'status'>,
) {
  await campoDb.syncQueue.put({ ...item, status: 'pending' });
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('gg-sync');
  }
}

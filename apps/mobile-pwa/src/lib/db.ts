import Dexie, { type Table } from 'dexie';

export type SyncQueueItem = {
  operationId: string;
  type: 'dailyEggProduction' | 'dailyMortality' | 'dailyFeedConsumption';
  payload: Record<string, unknown>;
  clientUpdatedAt: string;
  status: 'pending' | 'sent' | 'failed';
};

class CampoDb extends Dexie {
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('gestorgranja_campo');
    this.version(1).stores({
      syncQueue: 'operationId, status',
    });
  }
}

export const campoDb = new CampoDb();

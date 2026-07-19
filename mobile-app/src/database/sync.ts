import { syncApi } from '../services/api';
import { repository } from './repository';
import { TABLES } from './schema';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SYNC_VERSION = 2;
const LAST_PULLED_KEY = `sync_last_pulled_at_v${SYNC_VERSION}`;

const ALL_TABLES = [
  TABLES.ACCOUNTS,
  TABLES.TRANSACTIONS,
  TABLES.CATEGORIES,
  TABLES.BUDGETS,
  TABLES.GOALS,
  TABLES.BILLS,
  TABLES.RECURRING,
  TABLES.ALERTS,
];

const BACKEND_TABLE_MAP: Record<string, string> = {
  accounts: 'accounts',
  categories: 'categories',
  transactions: 'transactions',
  budgets: 'budgets',
  recurring_transactions: 'recurring',
  goals: 'goals',
  alerts: 'alerts',
  bills: 'bills',
  financial_memories: 'memories',
};

export async function getLastPulledAt(): Promise<string> {
  const val = await AsyncStorage.getItem(LAST_PULLED_KEY);
  return val || '1970-01-01T00:00:00Z';
}

export async function setLastPulledAt(timestamp: string): Promise<void> {
  await AsyncStorage.setItem(LAST_PULLED_KEY, timestamp);
}

export async function pullChanges(): Promise<number> {
  const lastPulledAt = await getLastPulledAt();
  let totalChanges = 0;

  const res = await syncApi.pull({ last_pulled_at: lastPulledAt });
  const { changes, timestamp: newTimestamp } = res.data;

  if (!changes || typeof changes !== 'object') {
    if (newTimestamp) await setLastPulledAt(newTimestamp);
    return 0;
  }

  for (const [backendTable, tableChanges] of Object.entries(changes) as any) {
    const localTable = BACKEND_TABLE_MAP[backendTable];
    if (!localTable) continue;

    const { created = [], updated = [], deleted = [] } = tableChanges as any;

    const upsertItems = [...created, ...updated];
    if (upsertItems.length > 0) {
      await repository.upsertBatch(localTable, upsertItems);
    }
    for (const del of deleted) {
      if (del.id) {
        await repository.hardDelete(localTable, del.id);
      }
    }

    totalChanges += upsertItems.length + deleted.length;
  }

  if (newTimestamp) await setLastPulledAt(newTimestamp);

  return totalChanges;
}

export async function getLocalChanges(): Promise<any[]> {
  let allChanges: any[] = [];

  for (const table of ALL_TABLES) {
    const since = await getLastPulledAt();
    const changes = await repository.getSyncChanges(table, since);
    allChanges = allChanges.concat(changes);
  }

  return allChanges;
}

export async function pushChanges(): Promise<{ success: boolean; conflicts: any[] }> {
  const flatChanges = await getLocalChanges();
  if (flatChanges.length === 0) return { success: true, conflicts: [] };

  const grouped: Record<string, { created: any[]; updated: any[]; deleted: any[] }> = {};
  for (const c of flatChanges) {
    if (!grouped[c.table_name]) grouped[c.table_name] = { created: [], updated: [], deleted: [] };
    if (c.action === 'create') {
      const rec = { ...c.data };
      if (rec.updated_at) delete rec.updated_at;
      if (rec.changed_at) delete rec.changed_at;
      grouped[c.table_name].created.push(rec);
    } else if (c.action === 'update') {
      const rec = { ...c.data };
      if (rec.updated_at) delete rec.updated_at;
      if (rec.changed_at) delete rec.changed_at;
      grouped[c.table_name].updated.push(rec);
    } else if (c.action === 'delete') {
      grouped[c.table_name].deleted.push({ id: c.record_id });
    }
  }

  const res = await syncApi.push({ changes: grouped });

  const result = res.data || {};

  for (const c of flatChanges) {
    await repository.update(c.table_name, c.record_id, { updated_at: new Date().toISOString() });
  }
  const newTimestamp = new Date().toISOString();
  await setLastPulledAt(newTimestamp);

  return { success: true, conflicts: [] };
}

export async function fullSync(): Promise<{ pulled: number; pushed: number; conflicts: number }> {
  const pushResult = await pushChanges();
  const pulled = await pullChanges();

  return {
    pulled,
    pushed: pushResult.success ? 1 : 0,
    conflicts: pushResult.conflicts.length,
  };
}

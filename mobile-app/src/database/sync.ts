import { syncApi } from '../services/api';
import { repository } from './repository';
import { TABLES } from './schema';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_PULLED_KEY = 'sync_last_pulled_at';
const PENDING_KEY = 'sync_pending_changes';

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
  let cursor: string | null = null;

  do {
    const params: Record<string, any> = { last_pulled_at: lastPulledAt, page_size: 500 };
    if (cursor) params.cursor = cursor;

    const res = await syncApi.pull(params);
    const { changes, last_pulled_at: newTimestamp, has_more, cursor: nextCursor } = res.data;

    if (!changes || changes.length === 0) {
      if (newTimestamp) await setLastPulledAt(newTimestamp);
      break;
    }

    const grouped: Record<string, Record<string, any>[]> = {};
    for (const change of changes) {
      const table = change.table_name;
      if (!grouped[table]) grouped[table] = [];
      grouped[table].push(change);
    }

    for (const [table, tableChanges] of Object.entries(grouped)) {
      const creates = tableChanges.filter((c: any) => c.action === 'create' || c.action === 'update');
      const deletes = tableChanges.filter((c: any) => c.action === 'delete');

      if (creates.length > 0) {
        await repository.upsertBatch(table, creates.map((c: any) => c.data));
      }
      for (const del of deletes) {
        if (del.data?.id) {
          await repository.hardDelete(table, del.data.id);
        } else {
          await repository.hardDelete(table, del.record_id);
        }
      }
    }

    totalChanges += changes.length;
    cursor = nextCursor || null;

    if (newTimestamp) await setLastPulledAt(newTimestamp);

    if (!has_more) break;
  } while (cursor);

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
  const changes = await getLocalChanges();
  if (changes.length === 0) return { success: true, conflicts: [] };

  const lastPulledAt = await getLastPulledAt();
  const res = await syncApi.push({ changes, last_pulled_at: lastPulledAt });

  const { success, conflicts = [] } = res.data;

  if (success) {
    for (const change of changes) {
      await repository.update(change.table_name, change.record_id, { updated_at: new Date().toISOString() });
    }
    const newTimestamp = new Date().toISOString();
    await setLastPulledAt(newTimestamp);
  }

  return { success, conflicts };
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

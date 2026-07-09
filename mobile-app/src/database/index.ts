import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES } from './schema';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('finance-tracker.db');
  await db.execAsync(CREATE_TABLES);
  return db;
}

export async function resetDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
  await SQLite.deleteDatabaseAsync('finance-tracker.db');
  db = await SQLite.openDatabaseAsync('finance-tracker.db');
  await db.execAsync(CREATE_TABLES);
}

export async function executeSql(sql: string, params?: any[]): Promise<any> {
  const database = await getDatabase();
  return database.runAsync(sql, params);
}

export async function queryAll(sql: string, params?: any[]): Promise<any[]> {
  const database = await getDatabase();
  return database.getAllAsync(sql, params);
}

export async function queryFirst(sql: string, params?: any[]): Promise<any> {
  const database = await getDatabase();
  return database.getFirstAsync(sql, params);
}

export function mapRowToCamelCase(row: Record<string, any>): Record<string, any> {
  if (!row) return row;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (camelKey === 'id' && typeof value === 'number') {
      result[camelKey] = String(value);
    } else {
      result[camelKey] = value;
    }
  }
  if (result.tags && typeof result.tags === 'string') {
    try { result.tags = JSON.parse(result.tags); } catch { result.tags = []; }
  }
  if (result.location && typeof result.location === 'string') {
    try { result.location = JSON.parse(result.location); } catch { result.location = null; }
  }
  if (result.metadata && typeof result.metadata === 'string') {
    try { result.metadata = JSON.parse(result.metadata); } catch { result.metadata = {}; }
  }
  return result;
}

export function mapRowsToCamelCase(rows: Record<string, any>[]): Record<string, any>[] {
  return rows.map(mapRowToCamelCase);
}

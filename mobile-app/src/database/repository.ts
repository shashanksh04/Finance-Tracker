import { queryAll, queryFirst, executeSql } from './index';
import { TABLES, TABLE_COLUMNS, stripUnknownFields } from './schema';
import { useAuthStore } from '../stores/authStore';

type WhereClause = { field: string; op?: string; value: any };

function buildWhere(where?: WhereClause[]): { sql: string; params: any[] } {
  if (!where || where.length === 0) return { sql: '', params: [] };

  const clauses = where.map((w, i) => {
    const op = w.op || '=';
    const paramRef = `?`;
    return `${w.field} ${op} ${paramRef}`;
  });

  return {
    sql: 'WHERE ' + clauses.join(' AND ') + ' AND deleted_at IS NULL',
    params: where.map((w) => w.value),
  };
}

function buildSet(data: Record<string, any>): { sql: string; params: any[] } {
  const fields = Object.keys(data);
  const sql = fields.map((f) => `${f} = ?`).join(', ');
  const params = fields.map((f) => {
    const v = data[f];
    if (typeof v === 'object' && v !== null) return JSON.stringify(v);
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v;
  });
  return { sql, params };
}

export const repository = {
  async list(table: string, where?: WhereClause[], orderBy?: string) {
    const w = buildWhere(where || []);
    const order = orderBy ? `ORDER BY ${orderBy}` : '';
    return queryAll(`SELECT * FROM ${table} ${w.sql} ${order}`, w.params);
  },

  async getById(table: string, id: string) {
    return queryFirst(`SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`, [id]);
  },

  async create(table: string, data: Record<string, any>) {
    const now = new Date().toISOString();
    let record = stripUnknownFields(table, data);
    if (!record.created_at) record.created_at = now;
    record.updated_at = data.updated_at || now;

    if (record.user_id === undefined || record.user_id === null) {
      const allowed = TABLE_COLUMNS[table];
      if (allowed?.includes('user_id')) {
        const user = useAuthStore.getState().user;
        if (user?.id) record.user_id = user.id;
      }
    }

    const fields = Object.keys(record);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map((f) => {
      const v = record[f];
      if (typeof v === 'object' && v !== null) return JSON.stringify(v);
      if (typeof v === 'boolean') return v ? 1 : 0;
      return v;
    });

    await executeSql(
      `INSERT OR REPLACE INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    return record;
  },

  async update(table: string, id: string, data: Record<string, any>) {
    const now = new Date().toISOString();
    const record = stripUnknownFields(table, { ...data, updated_at: now });

    const { sql, params } = buildSet(record);
    params.push(id);

    await executeSql(`UPDATE ${table} SET ${sql} WHERE id = ?`, params);
    return this.getById(table, id);
  },

  async delete(table: string, id: string) {
    const now = new Date().toISOString();
    await executeSql(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`, [now, now, id]);
  },

  async hardDelete(table: string, id: string) {
    await executeSql(`DELETE FROM ${table} WHERE id = ?`, [id]);
  },

  async upsertBatch(table: string, records: Record<string, any>[]) {
    for (const record of records) {
      await this.create(table, record);
    }
  },

  async getDeletedSince(table: string, since: string) {
    return queryAll(
      `SELECT * FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at > ?`,
      [since]
    );
  },

  async getUpdatedSince(table: string, since: string) {
    return queryAll(
      `SELECT * FROM ${table} WHERE updated_at > ? AND deleted_at IS NULL`,
      [since]
    );
  },

  async getSyncChanges(table: string, since: string): Promise<any[]> {
    const created = await queryAll(
      `SELECT * FROM ${table} WHERE created_at > ? AND deleted_at IS NULL`,
      [since]
    );
    const updated = await queryAll(
      `SELECT * FROM ${table} WHERE updated_at > ? AND created_at <= ? AND deleted_at IS NULL`,
      [since, since]
    );
    const deleted = await queryAll(
      `SELECT id FROM ${table} WHERE deleted_at > ?`,
      [since]
    );

    const changes: any[] = [];

    for (const row of created) {
      changes.push({ table_name: table, record_id: row.id, action: 'create', data: row, changed_at: row.updated_at });
    }
    for (const row of updated) {
      changes.push({ table_name: table, record_id: row.id, action: 'update', data: row, changed_at: row.updated_at });
    }
    for (const row of deleted) {
      changes.push({ table_name: table, record_id: row.id, action: 'delete', data: { id: row.id }, changed_at: row.deleted_at });
    }

    return changes;
  },

  async search(table: string, query: string, fields: string[]) {
    const conditions = fields.map((f) => `${f} LIKE ?`);
    const sql = `SELECT * FROM ${table} WHERE (${conditions.join(' OR ')}) AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 20`;
    const params = fields.map(() => `%${query}%`);
    return queryAll(sql, params);
  },

  async getSummary(table: string, field: string, agg: 'SUM' | 'COUNT' | 'AVG' | 'MAX' | 'MIN' = 'SUM', where?: WhereClause[]) {
    const w = buildWhere(where || []);
    const row = await queryFirst(`SELECT ${agg}(${field}) as value FROM ${table} ${w.sql}`, w.params);
    return row?.value || 0;
  },
};

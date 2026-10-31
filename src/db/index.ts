import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      min: 1,
      max: 10,
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 300000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export async function warmDatabasePool(): Promise<void> {
  if (!process.env.SQL_HOST) return;
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.warn('Database warm-up ping deferred:', err instanceof Error ? err.message : err);
  }
}

export const db = drizzle(pool, { schema });

import { Pool } from 'pg';

/**
 * Postgres connection pool.
 *
 * `DATA_BACKEND` decides how hard the app leans on the database:
 *   postgres — required; a connection failure is fatal.
 *   file     — never connect; serve the version-controlled dataset.
 *   auto     — try Postgres, fall back to the dataset (the default, so that
 *              `npm run dev` works before anyone starts a container).
 */
export type DataBackend = 'auto' | 'postgres' | 'file';

export function configuredBackend(): DataBackend {
  const raw = (process.env.DATA_BACKEND ?? 'auto').toLowerCase();
  return raw === 'postgres' || raw === 'file' ? raw : 'auto';
}

let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (configuredBackend() === 'file') return null;
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (configuredBackend() === 'postgres') {
      throw new Error('DATA_BACKEND=postgres but DATABASE_URL is not set.');
    }
    return null;
  }
  if (!pool) {
    pool = new Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 4000 });
    // A pool-level error must not take the process down; the app can serve the
    // file-backed dataset instead.
    pool.on('error', (err) => {
      console.error('[db] idle client error:', err.message);
    });
  }
  return pool;
}

export async function pingDatabase(): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    await p.query('SELECT 1');
    return true;
  } catch (err) {
    if (configuredBackend() === 'postgres') throw err;
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

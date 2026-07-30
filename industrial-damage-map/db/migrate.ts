/**
 * Applies db/migrations/*.sql in filename order, then optionally seeds.
 *
 *   tsx db/migrate.ts            apply migrations
 *   tsx db/migrate.ts --seed     apply migrations, then load the dataset
 *   tsx db/migrate.ts --reset    drop and recreate the public schema first
 *
 * Migrations are recorded in `schema_migrations` so re-running is a no-op.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, 'migrations');

async function waitForDatabase(pool: Pool, attempts = 30): Promise<void> {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (i === attempts) throw err;
      const delay = Math.min(1000 * i, 5000);
      console.log(`[migrate] database not ready (attempt ${i}/${attempts}), retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[migrate] DATABASE_URL is not set.');
    process.exit(1);
  }

  const reset = process.argv.includes('--reset');
  const seed = process.argv.includes('--seed');

  const pool = new Pool({ connectionString: url, max: 2 });
  await waitForDatabase(pool);

  if (reset) {
    console.log('[migrate] dropping and recreating schema "public"');
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rowCount } = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
    if (rowCount) {
      console.log(`[migrate] ${file} — already applied`);
      continue;
    }
    const sqlText = readFileSync(join(migrationsDir, file), 'utf8');
    console.log(`[migrate] applying ${file}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sqlText);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  await pool.end();
  console.log('[migrate] done');

  if (seed) {
    const { runSeed } = await import('./seed.js').catch(() => import('./seed'));
    await runSeed();
  }
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});

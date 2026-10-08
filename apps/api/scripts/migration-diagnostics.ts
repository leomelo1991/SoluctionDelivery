import pg from 'pg';
import { migrationDatabaseUrl } from './migration-url.js';

export function migrationTarget(env: NodeJS.ProcessEnv) {
  const connectionString = migrationDatabaseUrl(env);
  const url = new URL(connectionString);
  if (url.hostname.endsWith('.neon.tech') && url.hostname.includes('-pooler.'))
    throw new Error(
      'A conexão efetiva de migrations ainda usa o pooler do Neon. Revise DATABASE_URL_UNPOOLED em Production.',
    );
  return { connectionString, hostname: url.hostname, database: url.pathname.slice(1) };
}

export async function diagnoseMigrations(env: NodeJS.ProcessEnv) {
  const target = migrationTarget(env);
  console.log(
    `[migrations] commit=${env.VERCEL_GIT_COMMIT_SHA ?? 'local'} host=${target.hostname} database=${target.database}`,
  );
  const client = new pg.Client({
    connectionString: target.connectionString,
    application_name: 'solution-migration-diagnostics',
    connectionTimeoutMillis: 15000,
    query_timeout: 10000,
  });
  try {
    await client.connect();
    const result = await client.query(`
      SELECT l.pid, l.granted, l.classid::text AS lock_class, l.objid::text AS lock_id,
        a.application_name, a.state,
        EXTRACT(EPOCH FROM (now() - a.state_change))::int AS state_age_seconds
      FROM pg_locks l
      JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE l.locktype = 'advisory' AND a.datname = current_database()
      ORDER BY l.granted DESC, l.pid
      LIMIT 20
    `);
    console.log('[migrations] advisory locks:', JSON.stringify(result.rows));
  } catch (error) {
    // Do not print connection strings or arbitrary provider error payloads.
    const code =
      error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';
    console.error(`[migrations] Falha na conexão de diagnóstico (${code}).`);
    throw new Error('Diagnóstico de migrations falhou; confira host e código acima.');
  } finally {
    await client.end();
  }
}

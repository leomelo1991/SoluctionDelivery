// Prisma CLI uses a direct connection; the application keeps DATABASE_URL pooling.
export function migrationDatabaseUrl(env: NodeJS.ProcessEnv): string {
  for (const name of [
    'DATABASE_URL_UNPOOLED',
    'DIRECT_URL',
    'POSTGRES_URL_NON_POOLING',
    'DATABASE_URL',
  ]) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return 'postgresql://solution:solution@localhost:5432/solution';
}

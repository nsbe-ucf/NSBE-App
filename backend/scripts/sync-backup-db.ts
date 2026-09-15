/**
 * One-shot full sync: copy Prisma app tables from primary (DATABASE_URL)
 * to backup (BACKUP_DATABASE_URL). Use after pointing primary at Supabase
 * so Railway Postgres has a complete baseline; the in-process mirror then
 * keeps it updated on an interval.
 *
 * Usage (from backend/):
 *   DATABASE_URL=... DIRECT_URL=... BACKUP_DATABASE_URL=... npm run db:sync-backup
 *
 * Never logs full connection strings — hostnames only.
 */
import { PrismaClient } from '@prisma/client';
import { syncPrimaryToBackup } from '../src/prisma/backup-sync.util';
import {
  classifyDatabaseHost,
  extractDatabaseHostname,
  isTruthyEnv,
} from '../src/prisma/database-url.util';

async function main() {
  const primaryUrl = process.env.DATABASE_URL;
  const backupUrl = process.env.BACKUP_DATABASE_URL;

  if (!primaryUrl || !backupUrl) {
    throw new Error('DATABASE_URL and BACKUP_DATABASE_URL are both required');
  }

  const primaryHost = extractDatabaseHostname(primaryUrl);
  const backupHost = extractDatabaseHostname(backupUrl);

  const primaryKind = classifyDatabaseHost(primaryHost);
  const backupKind = classifyDatabaseHost(backupHost);
  const recovery = isTruthyEnv(process.env.BACKUP_SYNC_RECOVERY);

  console.log(
    `Sync primary → backup | primary=${primaryHost} (${primaryKind}) | backup=${backupHost} (${backupKind})${recovery ? ' | recovery=true' : ''}`,
  );

  if (primaryHost && backupHost && primaryHost === backupHost) {
    throw new Error(
      'Primary and backup hosts are identical; refusing to sync a database onto itself',
    );
  }

  if (!recovery) {
    if (primaryKind !== 'supabase' && primaryKind !== 'local') {
      throw new Error(
        'Refusing sync from a non-Supabase source. Set BACKUP_SYNC_RECOVERY=true only for documented Railway→Supabase reconciliation.',
      );
    }
    if (backupKind !== 'railway' && backupKind !== 'local') {
      throw new Error(
        'Refusing sync to a non-Railway target. Set BACKUP_SYNC_RECOVERY=true only for documented Railway→Supabase reconciliation.',
      );
    }
  }

  const primary = new PrismaClient({
    datasources: { db: { url: primaryUrl } },
  });
  const backup = new PrismaClient({
    datasources: { db: { url: backupUrl } },
  });

  await primary.$connect();
  await backup.$connect();

  const result = await syncPrimaryToBackup(primary, backup);
  for (const [name, count] of Object.entries(result.tables)) {
    console.log(`  ${name}: ${count} row(s)`);
  }

  await primary.$disconnect();
  await backup.$disconnect();
  console.log('Backup sync complete');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Backup sync failed: ${message}`);
  process.exit(1);
});

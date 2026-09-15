import { Injectable } from '@nestjs/common';
import {
  classifyDatabaseHost,
  extractDatabaseHostname,
} from './prisma/database-url.util';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  /**
   * Public DB-role summary for cutover checks. Kinds only — no hostnames,
   * connection strings, or ALLOW_RAILWAY_PRIMARY (those belong in logs/ops).
   */
  getDatabaseStatus() {
    const primaryHost = extractDatabaseHostname(process.env.DATABASE_URL);
    const backupHost = extractDatabaseHostname(process.env.BACKUP_DATABASE_URL);
    const primaryKind = classifyDatabaseHost(primaryHost);
    const backupKind = classifyDatabaseHost(backupHost);

    return {
      primary: {
        kind: primaryKind,
      },
      backup: backupHost
        ? { kind: backupKind, configured: true }
        : { configured: false },
      policy: {
        expectedPrimary: 'supabase',
        railwayIsBackupOnly: true,
      },
    };
  }
}

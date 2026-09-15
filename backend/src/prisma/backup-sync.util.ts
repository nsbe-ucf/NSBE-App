import { PrismaClient } from '@prisma/client';

type Row = Record<string, unknown>;

type SyncStep = {
  name: string;
  fetch: (db: PrismaClient) => Promise<Row[]>;
  upsert: (db: PrismaClient, row: Row) => Promise<unknown>;
  deleteAbsent: (db: PrismaClient, keepIds: Set<string>) => Promise<void>;
};

async function deleteByAbsentId(
  fetchIds: (db: PrismaClient) => Promise<{ id: string }[]>,
  remove: (db: PrismaClient, ids: string[]) => Promise<unknown>,
  db: PrismaClient,
  keepIds: Set<string>,
): Promise<void> {
  const existing = await fetchIds(db);
  const stale = existing.map((row) => row.id).filter((id) => !keepIds.has(id));
  if (stale.length === 0) {
    return;
  }
  await remove(db, stale);
}

/**
 * Remove a backup Member and rows that Restrict-delete against it.
 * Friendship / OAuthAccount / EventInterest cascade from Member.
 */
export async function purgeBackupMembers(
  db: PrismaClient,
  memberIds: string[],
): Promise<void> {
  if (memberIds.length === 0) {
    return;
  }

  await db.$transaction(async (tx) => {
    await tx.pointEntry.deleteMany({
      where: {
        OR: [
          { memberId: { in: memberIds } },
          { awardedById: { in: memberIds } },
        ],
      },
    });
    await tx.attendance.deleteMany({
      where: { memberId: { in: memberIds } },
    });
    await tx.event.updateMany({
      where: { createdById: { in: memberIds } },
      data: { createdById: null },
    });
    await tx.member.deleteMany({ where: { id: { in: memberIds } } });
  });
}

/** FK-safe order for copying Prisma app data primary → backup. */
export const BACKUP_SYNC_ORDER: SyncStep[] = [
  {
    name: 'Member',
    fetch: (db) => db.member.findMany(),
    upsert: async (db, row) => {
      // Seed backups often share emails with primary but have different UUIDs.
      // Upsert-by-id then collides on email unique — remove the stale row first.
      const email = row.email as string | null | undefined;
      const id = row.id as string;
      if (email) {
        const stale = await db.member.findMany({
          where: { email, NOT: { id } },
          select: { id: true },
        });
        await purgeBackupMembers(
          db,
          stale.map((member) => member.id),
        );
      }
      return db.member.upsert({
        where: { id },
        create: row as never,
        update: row as never,
      });
    },
    deleteAbsent: (db, keepIds) =>
      deleteByAbsentId(
        (client) => client.member.findMany({ select: { id: true } }),
        (client, ids) => purgeBackupMembers(client, ids),
        db,
        keepIds,
      ),
  },
  {
    name: 'Event',
    fetch: (db) => db.event.findMany(),
    upsert: (db, row) =>
      db.event.upsert({
        where: { id: row.id as string },
        create: row as never,
        update: row as never,
      }),
    deleteAbsent: (db, keepIds) =>
      deleteByAbsentId(
        (client) => client.event.findMany({ select: { id: true } }),
        (client, ids) => client.event.deleteMany({ where: { id: { in: ids } } }),
        db,
        keepIds,
      ),
  },
  {
    name: 'OAuthAccount',
    fetch: (db) => db.oAuthAccount.findMany(),
    upsert: (db, row) =>
      db.oAuthAccount.upsert({
        where: { id: row.id as string },
        create: row as never,
        update: row as never,
      }),
    deleteAbsent: (db, keepIds) =>
      deleteByAbsentId(
        (client) => client.oAuthAccount.findMany({ select: { id: true } }),
        (client, ids) =>
          client.oAuthAccount.deleteMany({ where: { id: { in: ids } } }),
        db,
        keepIds,
      ),
  },
  {
    name: 'Friendship',
    fetch: (db) => db.friendship.findMany(),
    upsert: (db, row) =>
      db.friendship.upsert({
        where: { id: row.id as string },
        create: row as never,
        update: row as never,
      }),
    deleteAbsent: (db, keepIds) =>
      deleteByAbsentId(
        (client) => client.friendship.findMany({ select: { id: true } }),
        (client, ids) =>
          client.friendship.deleteMany({ where: { id: { in: ids } } }),
        db,
        keepIds,
      ),
  },
  {
    name: 'EventInterest',
    fetch: (db) => db.eventInterest.findMany(),
    upsert: (db, row) =>
      db.eventInterest.upsert({
        where: { id: row.id as string },
        create: row as never,
        update: row as never,
      }),
    deleteAbsent: (db, keepIds) =>
      deleteByAbsentId(
        (client) => client.eventInterest.findMany({ select: { id: true } }),
        (client, ids) =>
          client.eventInterest.deleteMany({ where: { id: { in: ids } } }),
        db,
        keepIds,
      ),
  },
  {
    name: 'Attendance',
    fetch: (db) => db.attendance.findMany(),
    upsert: (db, row) =>
      db.attendance.upsert({
        where: { id: row.id as string },
        create: row as never,
        update: row as never,
      }),
    deleteAbsent: (db, keepIds) =>
      deleteByAbsentId(
        (client) => client.attendance.findMany({ select: { id: true } }),
        (client, ids) =>
          client.attendance.deleteMany({ where: { id: { in: ids } } }),
        db,
        keepIds,
      ),
  },
  {
    name: 'PointEntry',
    fetch: (db) => db.pointEntry.findMany(),
    upsert: (db, row) =>
      db.pointEntry.upsert({
        where: { id: row.id as string },
        create: row as never,
        update: row as never,
      }),
    deleteAbsent: (db, keepIds) =>
      deleteByAbsentId(
        (client) => client.pointEntry.findMany({ select: { id: true } }),
        (client, ids) =>
          client.pointEntry.deleteMany({ where: { id: { in: ids } } }),
        db,
        keepIds,
      ),
  },
];

export const BACKUP_DELETE_ORDER = [...BACKUP_SYNC_ORDER].reverse();

export type BackupSyncResult = {
  tables: Record<string, number>;
};

/** App tables only — never touch Railway system catalogs. FK-safe truncate order. */
export const BACKUP_TRUNCATE_SQL =
  'TRUNCATE TABLE "PointEntry", "Attendance", "event_interests", "friendships", "OAuthAccount", "Event", "Member" RESTART IDENTITY CASCADE';

/**
 * Wipe Prisma app data on the backup DB so a full primary→backup copy can land
 * without email/UUID collisions from leftover seed rows.
 */
export async function resetBackupAppTables(backup: PrismaClient): Promise<void> {
  await backup.$executeRawUnsafe(BACKUP_TRUNCATE_SQL);
}

/**
 * Upsert all app tables from primary into backup, then delete backup-only rows
 * in reverse FK order so a failover cannot restore revoked data.
 */
export async function syncPrimaryToBackup(
  primary: PrismaClient,
  backup: PrismaClient,
): Promise<BackupSyncResult> {
  const tables: Record<string, number> = {};
  const primaryRows = new Map<string, Row[]>();

  for (const step of BACKUP_SYNC_ORDER) {
    const rows = await step.fetch(primary);
    primaryRows.set(step.name, rows);
    let written = 0;
    for (const row of rows) {
      await step.upsert(backup, row);
      written += 1;
    }
    tables[step.name] = written;
  }

  for (const step of BACKUP_DELETE_ORDER) {
    const rows = primaryRows.get(step.name) ?? [];
    const keepIds = new Set(
      rows.map((row) => row.id).filter((id): id is string => typeof id === 'string'),
    );
    await step.deleteAbsent(backup, keepIds);
  }

  return { tables };
}

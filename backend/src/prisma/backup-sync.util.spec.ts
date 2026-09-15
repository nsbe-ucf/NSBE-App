import {
  BACKUP_DELETE_ORDER,
  BACKUP_SYNC_ORDER,
  BACKUP_TRUNCATE_SQL,
} from './backup-sync.util';

describe('backup-sync.util', () => {
  it('syncs models in FK-safe order starting with Member', () => {
    expect(BACKUP_SYNC_ORDER.map((s) => s.name)).toEqual([
      'Member',
      'Event',
      'OAuthAccount',
      'Friendship',
      'EventInterest',
      'Attendance',
      'PointEntry',
    ]);
  });

  it('deletes backup-only rows in reverse FK order', () => {
    expect(BACKUP_DELETE_ORDER.map((s) => s.name)).toEqual([
      'PointEntry',
      'Attendance',
      'EventInterest',
      'Friendship',
      'OAuthAccount',
      'Event',
      'Member',
    ]);
  });

  it('exposes truncate SQL covering all mirrored tables', () => {
    expect(BACKUP_TRUNCATE_SQL).toContain('"Member"');
    expect(BACKUP_TRUNCATE_SQL).toContain('"Event"');
    expect(BACKUP_TRUNCATE_SQL).toContain('"Attendance"');
  });
});

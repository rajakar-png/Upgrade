import cron from 'node-cron';
import { query, runSync, getOne } from '../config/db.js';
import { pterodactyl } from '../services/pterodactyl.js';

/**
 * Resolve the Pterodactyl server identifier for a server row.
 * Uses the cached column first; falls back to an API lookup + cache update.
 */
async function resolveIdentifier(server) {
  if (server.identifier) return server.identifier
  try {
    const details = await pterodactyl.getServerDetails(server.pterodactyl_server_id)
    if (details?.identifier) {
      await runSync('UPDATE servers SET identifier = ? WHERE id = ?', [details.identifier, server.id])
      return details.identifier
    }
  } catch {/* non-fatal */}
  return null
}

/**
 * Create/rotate automatic backups for all active servers that have a plan
 * with backup_count > 0.  Runs once a day at 3 AM.
 *
 * Strategy:
 *  1. Delete tracked auto-backups older than 24 h so the slot is freed.
 *  2. Create one new auto-backup only when we're under the limit.
 */
async function createBackups() {
  console.log('[BACKUP CRON] Starting scheduled backup run...');

  try {
    const servers = await query(
      `SELECT s.id, s.pterodactyl_server_id, s.identifier, s.plan_type, s.plan_id
       FROM servers s
       WHERE s.status = 'active'`,
      []
    );

    console.log(`[BACKUP CRON] ${servers.length} active servers to check`);

    for (const server of servers) {
      try {
        // Get plan backup limit
        const plan = await getOne(
          `SELECT backup_count FROM ${server.plan_type === 'coin' ? 'plans_coin' : 'plans_real'} WHERE id = ?`,
          [server.plan_id]
        );

        const backupLimit = plan?.backup_count || 0;
        if (backupLimit === 0) continue; // plan has no backup slots

        const identifier = await resolveIdentifier(server);
        if (!identifier) {
          console.warn(`[BACKUP CRON] No identifier for server ${server.id} — skipping`);
          continue;
        }

        // Rotate: delete auto-backups older than 24 h
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const oldBackups = await query(
          'SELECT id, pterodactyl_backup_uuid FROM server_backups WHERE server_id = ? AND is_automatic = 1 AND created_at < ?',
          [server.id, oneDayAgo]
        );

        for (const backup of oldBackups) {
          try {
            await pterodactyl.deleteBackup(identifier, backup.pterodactyl_backup_uuid);
            await runSync('DELETE FROM server_backups WHERE id = ?', [backup.id]);
            console.log(`[BACKUP CRON] Deleted old auto-backup ${backup.pterodactyl_backup_uuid} (server ${server.id})`);
          } catch (err) {
            console.error(`[BACKUP CRON] Delete failed for ${backup.pterodactyl_backup_uuid}:`, err.message);
          }
        }

        // Count current backups (manual + auto combined)
        const countRow = await getOne(
          'SELECT COUNT(*) as count FROM server_backups WHERE server_id = ?',
          [server.id]
        );
        const currentCount = countRow?.count || 0;

        if (currentCount < backupLimit) {
          const backupName = `auto-${new Date().toISOString().split('T')[0]}`;
          const backupUuid = await pterodactyl.createBackup(identifier, backupName);
          await runSync(
            'INSERT OR IGNORE INTO server_backups (server_id, pterodactyl_backup_uuid, name, is_automatic) VALUES (?, ?, ?, 1)',
            [server.id, backupUuid, backupName]
          );
          console.log(`[BACKUP CRON] Created auto-backup ${backupUuid} for server ${server.id}`);
        }
      } catch (err) {
        console.error(`[BACKUP CRON] Error processing server ${server.id}:`, err.message);
      }
    }

    console.log('[BACKUP CRON] Run complete');
  } catch (error) {
    console.error('[BACKUP CRON] Fatal error:', error);
  }
}

/**
 * Initialize backup cron job — runs daily at 3 AM server time.
 */
export function initBackupCron() {
  cron.schedule('0 3 * * *', async () => {
    console.log('[BACKUP CRON] Scheduled trigger...');
    try {
      await createBackups();
    } catch (err) {
      console.error('[BACKUP CRON] Unhandled error:', err.message);
    }
  });
  console.log('[BACKUP CRON] Initialized (daily at 03:00)');
}
